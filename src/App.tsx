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
  const guessesRef    = useRef<TileData[][]>([]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);

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

  /* ── Broadcast channel (best-effort pour game_won) ── */
  useEffect(() => {
    const channel = supabase.channel('game-events');

    channel
      .on('broadcast', { event: 'game_won' }, ({ payload }: { payload: WonPayload }) => {
        if (payload.winner_name === playerNameRef.current) return;
        fetchScores();
        startCountdown(payload.new_game, payload.winner_name, payload.winner_guesses, payload.word, false);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channelRef.current = channel;
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [startCountdown, fetchScores]);

  /* ── Présence DB : heartbeat toutes les 5s (avec progression) ── */
  useEffect(() => {
    if (!playerName) return;

    const heartbeat = () => {
      const progressTiles = guessesRef.current.map(row => row.map(t => t.state));
      supabase
        .from('online_players')
        .upsert(
          { name: playerName, last_seen: new Date().toISOString(), progress: progressTiles },
          { onConflict: 'name' },
        )
        .then();
    };

    heartbeat();                                    // signal immédiat
    const interval = setInterval(heartbeat, 5000);  // puis toutes les 5s

    return () => {
      clearInterval(interval);
      // best-effort : supprimer la ligne quand le composant se démonte
      supabase.from('online_players').delete().eq('name', playerName).then();
    };
  }, [playerName]);

  /* ── Présence DB : polling des joueurs en ligne + progression ── */
  useEffect(() => {
    if (!playerName) return;

    const poll = async () => {
      const cutoff = new Date(Date.now() - 15_000).toISOString();
      const { data } = await supabase
        .from('online_players')
        .select('name, progress')
        .gte('last_seen', cutoff);
      if (data) {
        setConnectedPlayers(data.map(p => p.name));
        // Mettre à jour la progression des autres joueurs depuis la DB
        const progressMap: Record<string, string[][]> = {};
        for (const p of data) {
          if (p.name !== playerName && Array.isArray(p.progress) && p.progress.length > 0) {
            progressMap[p.name] = p.progress;
          }
        }
        setPlayerProgress(progressMap);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [playerName]);

  /* ── Polling : détecter si la partie a été gagnée par quelqu'un ──
       IMPORTANT : ne PAS exclure gameOver ici,
       sinon un joueur qui a perdu ne sera jamais averti. */
  useEffect(() => {
    if (!game || winData) return;               // ← gameOver retiré
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('games')
          .select('status, winner_name, winner_guesses')
          .eq('id', game.id)
          .single();
        if (data && data.status === 'completed' && data.winner_name) {
          // La partie a été gagnée — charger la nouvelle partie
          const { data: newGame } = await supabase
            .from('games')
            .select('*')
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
          if (newGame && data.winner_name !== playerNameRef.current) {
            clearInterval(interval);  // Stopper le polling dès la détection
            fetchScores();
            startCountdown(
              newGame,
              data.winner_name,
              data.winner_guesses ?? 0,
              game.word,
              false,
            );
          }
        }
      } catch {
        // Erreur réseau — on réessaie au prochain cycle
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [game, winData, fetchScores, startCountdown]);

  /* ── Victoire ── */
  const handleWin = useCallback(async (guessCount: number) => {
    if (!game || !playerNameRef.current) return;
    setGameOver(true);
    const newWord = getRandomWord();
    try {
      const { data, error } = await supabase.rpc('complete_game', {
        p_game_id: game.id,
        p_winner_name: playerNameRef.current,
        p_winner_guesses: guessCount,
        p_new_word: newWord,
      });
      if (error) {
        console.error('[handleWin] RPC error:', error);
        showToast('Erreur réseau — réessaie !');
        setGameOver(false);
        return;
      }
      if (!data?.success) {
        // Quelqu'un d'autre a gagné juste avant nous (race condition)
        console.warn('[handleWin] Game already completed');
        return;
      }
      const payload: WonPayload = {
        winner_name: playerNameRef.current,
        winner_guesses: guessCount,
        word: game.word,
        new_game: data.new_game,
      };
      // Envoyer le broadcast (best-effort, le polling prend le relais si ça échoue)
      channelRef.current?.send({ type: 'broadcast', event: 'game_won', payload })
        .catch((err: unknown) => console.warn('[handleWin] broadcast failed:', err));
      fetchScores();
      startCountdown(data.new_game, playerNameRef.current, guessCount, game.word, true);
    } catch (err) {
      console.error('[handleWin] unexpected error:', err);
      showToast('Erreur — réessaie !');
      setGameOver(false);
    }
  }, [game, startCountdown, fetchScores, showToast]);

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

    // Sauvegarder la progression dans la DB (les autres joueurs la liront via polling)
    const progressTiles = newGuesses.map(row => row.map(t => t.state));
    supabase
      .from('online_players')
      .upsert(
        { name: playerNameRef.current, last_seen: new Date().toISOString(), progress: progressTiles },
        { onConflict: 'name' },
      )
      .then();

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
