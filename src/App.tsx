import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getRandomWord, isValidWord } from './lib/words';
import { evaluateGuess, buildKeyboardStates, WORD_LENGTH, MAX_GUESSES } from './lib/gameLogic';
import { Board } from './components/Board';
import { Keyboard } from './components/Keyboard';
import { WinNotification } from './components/WinNotification';
import { NameModal } from './components/NameModal';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import type { TileData, Game } from './types';

const COUNTDOWN_SECONDS = 6;

// Payload du broadcast envoyé quand quelqu'un gagne
interface WonPayload {
  winner_name: string;
  winner_guesses: number;
  word: string;
  new_game: Game;
}

function App() {
  const [playerName, setPlayerName] = useState<string>(() =>
    localStorage.getItem('wordle_name') || ''
  );
  const [game, setGame] = useState<Game | null>(null);
  const [guesses, setGuesses] = useState<TileData[][]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [currentRow, setCurrentRow] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [lost, setLost] = useState(false);
  const [shake, setShake] = useState(false);
  const [toast, setToast] = useState('');
  const [winData, setWinData] = useState<{ name: string; guesses: number; word: string; isMe: boolean } | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const playerNameRef = useRef(playerName);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

  /* ── Toast ── */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2500);
  }, []);

  /* ── Reset local state ── */
  const resetLocalGame = useCallback(() => {
    setGuesses([]);
    setCurrentGuess('');
    setCurrentRow(0);
    setGameOver(false);
    setLost(false);
    setWinData(null);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  /* ── Countdown avant nouveau mot ── */
  const startCountdown = useCallback((
    newGame: Game,
    winnerName: string,
    winnerGuesses: number,
    word: string,
    isMe: boolean,
  ) => {
    setWinData({ name: winnerName, guesses: winnerGuesses, word, isMe });
    setCountdown(COUNTDOWN_SECONDS);

    let remaining = COUNTDOWN_SECONDS;
    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        setGame(newGame);
        resetLocalGame();
      }
    }, 1000);
  }, [resetLocalGame]);

  /* ── Chargement de la partie active au démarrage ── */
  useEffect(() => {
    async function loadGame() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // Aucune partie active — on en crée une
        const word = getRandomWord();
        const { data: newGame, error: insertError } = await supabase
          .from('games')
          .insert({ word, status: 'active' })
          .select()
          .single();

        if (insertError) {
          // Race condition : un autre client a déjà créé une partie
          const { data: existing } = await supabase
            .from('games')
            .select('*')
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
          if (existing) setGame(existing);
        } else if (newGame) {
          setGame(newGame);
        }
      } else {
        setGame(data);
      }
    }

    loadGame();
  }, []);

  /* ── Abonnement Realtime via Broadcast ── */
  useEffect(() => {
    // On utilise Supabase Broadcast — plus fiable que postgres_changes pour
    // les notifications temps réel entre clients.
    const channel = supabase.channel('game-events', {
      config: { broadcast: { self: false } }, // ne pas recevoir ses propres messages
    });

    channel
      .on('broadcast', { event: 'game_won' }, ({ payload }: { payload: WonPayload }) => {
        // Ignoré si c'est nous qui avons gagné (déjà géré dans handleWin)
        if (payload.winner_name === playerNameRef.current) return;
        startCountdown(payload.new_game, payload.winner_name, payload.winner_guesses, payload.word, false);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [startCountdown]);

  /* ── Victoire ── */
  const handleWin = useCallback(async (guessCount: number) => {
    if (!game || !playerNameRef.current) return;
    setGameOver(true);

    const newWord = getRandomWord();
    const { data } = await supabase.rpc('complete_game', {
      p_game_id: game.id,
      p_winner_name: playerNameRef.current,
      p_winner_guesses: guessCount,
      p_new_word: newWord,
    });

    if (data?.success) {
      const payload: WonPayload = {
        winner_name: playerNameRef.current,
        winner_guesses: guessCount,
        word: game.word,
        new_game: data.new_game,
      };

      // Broadcast aux autres joueurs
      channelRef.current?.send({
        type: 'broadcast',
        event: 'game_won',
        payload,
      });

      startCountdown(data.new_game, playerNameRef.current, guessCount, game.word, true);
    }
    // Si success=false → quelqu'un d'autre a gagné en même temps
    // → leur broadcast déclenchera startCountdown pour nous
  }, [game, startCountdown]);

  /* ── Défaite ── */
  const handleLose = useCallback((word: string) => {
    setGameOver(true);
    setLost(true);
    showToast(`Le mot était : ${word}`);
  }, [showToast]);

  /* ── Soumettre un essai ── */
  const submitGuess = useCallback(() => {
    if (!game || gameOver || currentGuess.length !== WORD_LENGTH || winData) return;

    if (!isValidWord(currentGuess)) {
      showToast('Mot non reconnu');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    const result = evaluateGuess(currentGuess, game.word);
    const newGuesses = [...guesses, result];
    setGuesses(newGuesses);
    setCurrentGuess('');
    setCurrentRow(r => r + 1);

    const won = result.every(t => t.state === 'correct');
    if (won) {
      handleWin(newGuesses.length);
    } else if (newGuesses.length >= MAX_GUESSES) {
      handleLose(game.word);
    }
  }, [game, gameOver, currentGuess, guesses, winData, showToast, handleWin, handleLose]);

  /* ── Gestion clavier ── */
  const handleKey = useCallback((key: string) => {
    if (gameOver || winData) return;

    if (key === '⌫' || key === 'Backspace') {
      setCurrentGuess(g => g.slice(0, -1));
    } else if (key === 'ENTER' || key === 'Enter') {
      submitGuess();
    } else if (/^[A-Za-z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      setCurrentGuess(g => g + key.toUpperCase());
    }
  }, [gameOver, winData, currentGuess, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKey(e.key);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  /* ── Modal pseudo ── */
  if (!playerName) {
    return (
      <NameModal onConfirm={(name) => {
        localStorage.setItem('wordle_name', name);
        setPlayerName(name);
      }} />
    );
  }

  const keyStates = buildKeyboardStates(guesses);

  return (
    <div className="app">
      <Header playerName={playerName} />
      <main className="main">
        {toast && <Toast message={toast} />}
        <Board
          guesses={guesses}
          currentGuess={currentGuess}
          currentRow={currentRow}
          shake={shake}
        />
        {lost && !winData && (
          <p className="waiting-msg">⏳ En attente du prochain mot…</p>
        )}
        <Keyboard onKey={handleKey} keyStates={keyStates} />
      </main>
      {winData && (
        <WinNotification
          winnerName={winData.name}
          word={winData.word}
          isMe={winData.isMe}
          guesses={winData.guesses}
          countdown={countdown}
        />
      )}
    </div>
  );
}

export default App;
