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
import { Sidebar } from './components/Sidebar';
import type { Score } from './components/Sidebar';
import type { TileData, Game } from './types';

const COUNTDOWN_SECONDS = 6;

interface WonPayload {
  winner_name: string;
  winner_guesses: number;
  word: string;
  new_game: Game;
}

interface GuessMadePayload {
  player_name: string;
  game_id: string;
  tiles: string[]; // TileState[]
}

function getPresenceKey(): string {
  let key = sessionStorage.getItem('wordle_pkey');
  if (!key) {
    key = Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('wordle_pkey', key);
  }
  return key;
}

// ── Sauvegarde locale ──────────────────────────────────────────────────────
interface SavedState {
  gameId: string;
  guesses: TileData[][];
  currentRow: number;
  gameOver: boolean;
  lost: boolean;
}
const SAVE_KEY = 'wordle_save';
function loadSavedState(gameId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s: SavedState = JSON.parse(raw);
    return s.gameId === gameId ? s : null;
  } catch { return null; }
}
function saveState(s: SavedState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(s));
}

function App() {
  const [playerName, setPlayerName] = useState<string>(() =>
    localStorage.getItem('wordle_name') || ''
  );
  const [game, setGame]                   = useState<Game | null>(null);
  const [guesses, setGuesses]             = useState<TileData[][]>([]);
  const [currentGuess, setCurrentGuess]   = useState('');
  const [currentRow, setCurrentRow]       = useState(0);
  const [gameOver, setGameOver]           = useState(false);
  const [lost, setLost]                   = useState(false);
  const [shake, setShake]                 = useState(false);
  const [toast, setToast]                 = useState('');
  const [winData, setWinData]             = useState<{ name: string; guesses: number; word: string; isMe: boolean } | null>(null);
  const [countdown, setCountdown]         = useState(COUNTDOWN_SECONDS);
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);
  const [scores, setScores]               = useState<Score[]>([]);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  // progression des autres joueurs : { [pseudo]: [TileState[], ...] }
  const [playerProgress, setPlayerProgress] = useState<Record<string, string[][]>>({});

  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const playerNameRef = useRef(playerName);
  const gameRef       = useRef<Game | null>(null);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { gameRef.current = game; }, [game]);

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
    setPlayerProgress({});
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  /* ── Fetch scores ── */
  const fetchScores = useCallback(async () => {
    const { data } = await supabase
      .from('games').select('winner_name')
      .eq('status', 'completed').not('winner_name', 'is', null);
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const g of data) {
      if (g.winner_name) counts[g.winner_name] = (counts[g.winner_name] || 0) + 1;
    }
    setScores(
      Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, wins]) => ({ name, wins }))
    );
  }, []);

  /* ── Countdown ── */
  const startCountdown = useCallback((
    newGame: Game, winnerName: string, winnerGuesses: number, word: string, isMe: boolean,
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

  /* ── Chargement de la partie active ── */
  useEffect(() => {
    async function loadGame() {
      const { data, error } = await supabase
        .from('games').select('*').eq('status', 'active')
        .order('started_at', { ascending: false }).limit(1).single();

      if (error || !data) {
        const word = getRandomWord();
        const { data: newGame, error: insertError } = await supabase
          .from('games').insert({ word, status: 'active' }).select().single();
        if (insertError) {
          const { data: existing } = await supabase
            .from('games').select('*').eq('status', 'active')
            .order('started_at', { ascending: false }).limit(1).single();
          if (existing) setGame(existing);
        } else if (newGame) {
          setGame(newGame);
        }
      } else {
        setGame(data);
      }
    }
    loadGame();
    fetchScores();
  }, [fetchScores]);

  /* ── Restaurer les guesses depuis localStorage quand le game change ── */
  useEffect(() => {
    if (!game) return;
    const saved = loadSavedState(game.id);
    if (saved && saved.guesses.length > 0) {
      setGuesses(saved.guesses);
      setCurrentRow(saved.currentRow);
      setGameOver(saved.gameOver);
      setLost(saved.lost);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  /* ── Sauvegarder l'état après chaque guess ── */
  useEffect(() => {
    if (!game || guesses.length === 0) return;
    saveState({ gameId: game.id, guesses, currentRow, gameOver, lost });
  }, [game, guesses, currentRow, gameOver, lost]);

  /* ── Realtime : Broadcast + Presence ── */
  useEffect(() => {
    const channel = supabase.channel('game-events', {
      config: {
        broadcast: { self: false },
        presence:  { key: getPresenceKey() },
      },
    });

    const syncPresence = () => {
      const state = channel.presenceState<{ name: string }>();
      const names = Object.values(state).flat().map((p) => p.name).filter(Boolean);
      setConnectedPlayers([...new Set(names)]);
    };

    channel
      .on('broadcast', { event: 'game_won' }, ({ payload }: { payload: WonPayload }) => {
        if (payload.winner_name === playerNameRef.current) return;
        fetchScores();
        startCountdown(payload.new_game, payload.winner_name, payload.winner_guesses, payload.word, false);
      })
      .on('broadcast', { event: 'guess_made' }, ({ payload }: { payload: GuessMadePayload }) => {
        // Ignorer si c'est nous ou si c'est pour une autre partie
        if (payload.player_name === playerNameRef.current) return;
        if (payload.game_id !== gameRef.current?.id) return;
        setPlayerProgress(prev => ({
          ...prev,
          [payload.player_name]: [...(prev[payload.player_name] || []), payload.tiles],
        }));
      })
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: Array<{ name: string }> }) => {
        const names = newPresences.map(p => p.name).filter(Boolean);
        if (names.length) setConnectedPlayers(prev => [...new Set([...prev, ...names])]);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: Array<{ name: string }> }) => {
        const names = leftPresences.map(p => p.name).filter(Boolean);
        if (names.length) setConnectedPlayers(prev => prev.filter(n => !names.includes(n)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
          if (playerNameRef.current) {
            await channel.track({ name: playerNameRef.current });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [startCountdown, fetchScores]);

  /* ── Tracker la présence quand le pseudo est défini ── */
  useEffect(() => {
    if (playerName && channelRef.current) {
      channelRef.current.track({ name: playerName });
    }
  }, [playerName]);

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
      channelRef.current?.send({ type: 'broadcast', event: 'game_won', payload });
      fetchScores();
      startCountdown(data.new_game, playerNameRef.current, guessCount, game.word, true);
    }
  }, [game, startCountdown, fetchScores]);

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

    // Broadcast notre progression (couleurs seulement, pas les lettres)
    channelRef.current?.send({
      type: 'broadcast',
      event: 'guess_made',
      payload: {
        player_name: playerNameRef.current,
        game_id: game.id,
        tiles: result.map(t => t.state),
      } satisfies GuessMadePayload,
    });

    const won = result.every(t => t.state === 'correct');
    if (won) handleWin(newGuesses.length);
    else if (newGuesses.length >= MAX_GUESSES) handleLose(game.word);
  }, [game, gameOver, currentGuess, guesses, winData, showToast, handleWin, handleLose]);

  /* ── Clavier ── */
  const handleKey = useCallback((key: string) => {
    if (gameOver || winData) return;
    if (key === '⌫' || key === 'Backspace') setCurrentGuess(g => g.slice(0, -1));
    else if (key === 'ENTER' || key === 'Enter') submitGuess();
    else if (/^[A-Za-z]$/.test(key) && currentGuess.length < WORD_LENGTH)
      setCurrentGuess(g => g + key.toUpperCase());
  }, [gameOver, winData, currentGuess, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKey(e.key);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  if (!playerName) {
    return (
      <NameModal onConfirm={(name) => {
        localStorage.setItem('wordle_name', name);
        setPlayerName(name);
      }} />
    );
  }

  const keyStates = buildKeyboardStates(guesses);
  // Progression du joueur courant sous forme de TileState[][]
  const myProgress = guesses.map(row => row.map(t => t.state));

  return (
    <div className="page">
      <Header
        playerName={playerName}
        onlineCount={connectedPlayers.length}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        sidebarOpen={sidebarOpen}
      />
      <div className="layout">
        <div className="game-area">
          <main className="main">
            {toast && <Toast message={toast} />}
            <Board guesses={guesses} currentGuess={currentGuess} currentRow={currentRow} shake={shake} />
            {lost && !winData && <p className="waiting-msg">⏳ En attente du prochain mot…</p>}
            <Keyboard onKey={handleKey} keyStates={keyStates} />
          </main>
        </div>
        <Sidebar
          connectedPlayers={connectedPlayers}
          scores={scores}
          currentPlayer={playerName}
          myProgress={myProgress}
          playerProgress={playerProgress}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
        />
      </div>
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
