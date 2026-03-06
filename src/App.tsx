import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import { getRandomWord, isValidWord } from './lib/words';
import { evaluateGuess, buildKeyboardStates, WORD_LENGTH, MAX_GUESSES } from './lib/gameLogic';
import * as sounds from './lib/sounds';
import { vibrateKey, vibrateSubmit, vibrateError, vibrateWin } from './lib/haptics';
import { Board } from './components/Board';
import { Keyboard } from './components/Keyboard';
import { WinNotification } from './components/WinNotification';
import { NameModal } from './components/NameModal';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import type { Score } from './components/Sidebar';
import type { TileData, Game, ChatMessage, GameHistoryEntry } from './types';

const COUNTDOWN_SECONDS = 6;
const HISTORY_KEY = 'wordle_history';
const MAX_HISTORY = 20;

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

// ── Historique local ───────────────────────────────────────────────────────
function loadHistory(): GameHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHistory(entries: GameHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

// ── Streaks ────────────────────────────────────────────────────────────────
function computeStreaks(
  recentGames: { winner_name: string | null }[],
): Record<string, number> {
  const streaks: Record<string, number> = {};
  if (recentGames.length === 0) return streaks;

  let currentWinner = recentGames[0].winner_name;
  if (!currentWinner) return streaks;

  let count = 0;
  for (const g of recentGames) {
    if (g.winner_name === currentWinner) count++;
    else break;
  }
  streaks[currentWinner] = count;
  return streaks;
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
  const [lostWord, setLostWord]           = useState<string | null>(null);
  const [shake, setShake]                 = useState(false);
  const [toast, setToast]                 = useState('');
  const [winData, setWinData]             = useState<{ name: string; guesses: number; word: string; isMe: boolean } | null>(null);
  const [countdown, setCountdown]         = useState(COUNTDOWN_SECONDS);
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);
  const [scores, setScores]               = useState<Score[]>([]);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [playerProgress, setPlayerProgress] = useState<Record<string, string[][]>>({});
  // ── New state ──
  const [muted, setMuted]                 = useState(sounds.isMuted());
  const [chatMessages, setChatMessages]   = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat]       = useState(0);
  const [gameHistory, setGameHistory]     = useState<GameHistoryEntry[]>(() => loadHistory());

  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastRef      = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const playerNameRef = useRef(playerName);
  const gameRef       = useRef<Game | null>(null);
  const guessesRef    = useRef<TileData[][]>([]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);

  // ── Swipe gesture for sidebar (mobile) ──
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // Only horizontal swipes (ignore vertical scrolling)
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;

      if (dx < -60) setSidebarOpen(true);   // swipe left → open
      if (dx > 60)  setSidebarOpen(false);   // swipe right → close
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

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
    setLostWord(null);
    setWinData(null);
    setPlayerProgress({});
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  /* ── Save to history ── */
  const saveToHistory = useCallback((
    gameId: string, word: string, winnerName: string | null,
    myGuesses: TileData[][], won: boolean, didLose: boolean,
  ) => {
    setGameHistory(prev => {
      // Don't duplicate
      if (prev.some(e => e.gameId === gameId)) return prev;
      const entry: GameHistoryEntry = {
        gameId,
        word,
        winnerName,
        myGuesses: myGuesses.map(row => row.map(t => t.state)),
        won,
        lost: didLose,
        timestamp: new Date().toISOString(),
      };
      const updated = [entry, ...prev].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  }, []);

  /* ── Fetch scores + streaks ── */
  const fetchScores = useCallback(async () => {
    // Fetch all wins for leaderboard
    const { data } = await supabase
      .from('games').select('winner_name')
      .eq('status', 'completed').not('winner_name', 'is', null);
    if (!data) return;

    const counts: Record<string, number> = {};
    for (const g of data) {
      if (g.winner_name) counts[g.winner_name] = (counts[g.winner_name] || 0) + 1;
    }

    // Fetch recent games for streaks
    const { data: recent } = await supabase
      .from('games').select('winner_name')
      .eq('status', 'completed').not('winner_name', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(50);

    const streaks = computeStreaks(recent ?? []);

    setScores(
      Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, wins]) => ({ name, wins, streak: streaks[name] ?? 0 }))
    );
  }, []);

  /* ── Countdown ── */
  const startCountdown = useCallback((
    newGame: Game, winnerName: string, winnerGuesses: number, word: string, isMe: boolean,
  ) => {
    setWinData({ name: winnerName, guesses: winnerGuesses, word, isMe });
    setCountdown(COUNTDOWN_SECONDS);

    // Save current game to history
    if (gameRef.current) {
      saveToHistory(
        gameRef.current.id, gameRef.current.word, winnerName,
        guessesRef.current, isMe, !isMe,
      );
    }

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
  }, [resetLocalGame, saveToHistory]);

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

  /* ── Broadcast channel (game_won only) ── */
  useEffect(() => {
    const channel = supabase.channel('game-events');

    channel
      .on('broadcast', { event: 'game_won' }, ({ payload }: { payload: WonPayload }) => {
        if (payload.winner_name === playerNameRef.current) return;
        sounds.playOtherWin();
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

  /* ── Chat : chargement + Realtime + polling fallback ── */
  const lastChatTsRef = useRef<string>(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const addRemoteMessages = useCallback((rows: { id: string; sender: string; text: string; created_at: string }[]) => {
    if (rows.length === 0) return;
    // Mettre à jour le curseur pour le polling
    const maxTs = rows.reduce((max, r) => r.created_at > max ? r.created_at : max, lastChatTsRef.current);
    lastChatTsRef.current = maxTs;

    setChatMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newMsgs = rows
        .filter(m => !existingIds.has(m.id) && m.sender !== playerNameRef.current)
        .map(m => ({ id: m.id, sender: m.sender, text: m.text, timestamp: new Date(m.created_at).getTime() }));
      if (newMsgs.length === 0) return prev;
      // Jouer le son de notif pour les nouveaux messages
      sounds.playChatNotif();
      setUnreadChat(u => u + newMsgs.length);
      return [...prev, ...newMsgs];
    });
  }, []);

  useEffect(() => {
    // Charger les messages récents (dernières 24h)
    const loadRecent = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender, text, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(100);
      if (data && data.length > 0) {
        lastChatTsRef.current = data[data.length - 1].created_at;
        setChatMessages(data.map(m => ({
          id: m.id, sender: m.sender, text: m.text,
          timestamp: new Date(m.created_at).getTime(),
        })));
      }
    };
    loadRecent();

    // Realtime : écouter les INSERT (instantané quand ça marche)
    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const m = payload.new as { id: string; sender: string; text: string; created_at: string };
          addRemoteMessages([m]);
        },
      )
      .subscribe();

    // Polling fallback : vérifier les nouveaux messages toutes les 4s
    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender, text, created_at')
        .gt('created_at', lastChatTsRef.current)
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) addRemoteMessages(data);
    }, 4000);

    // Nettoyage des vieux messages (> 24h)
    supabase
      .from('chat_messages')
      .delete()
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .then();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [addRemoteMessages]);

  /* ── Send chat message ── */
  const sendChatMessage = useCallback((text: string) => {
    const name = playerNameRef.current;
    if (!name) return;
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const msg: ChatMessage = { id, sender: name, text, timestamp: Date.now() };
    // Ajouter localement immédiatement
    setChatMessages(prev => [...prev, msg]);
    // Persister en DB (le Realtime notifiera les autres joueurs)
    supabase.from('chat_messages').insert({ sender: name, text }).then();
  }, []);

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

    heartbeat();
    const interval = setInterval(heartbeat, 5000);

    return () => {
      clearInterval(interval);
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

  /* ── Polling : détecter si la partie a été gagnée par quelqu'un ── */
  useEffect(() => {
    if (!game || winData) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('games')
          .select('status, winner_name, winner_guesses')
          .eq('id', game.id)
          .single();
        if (data && data.status === 'completed' && data.winner_name) {
          const { data: newGame } = await supabase
            .from('games')
            .select('*')
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
          if (newGame && data.winner_name !== playerNameRef.current) {
            clearInterval(interval);
            sounds.playOtherWin();
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

  /* ── Auto-relance si tous les joueurs ont perdu ── */
  useEffect(() => {
    if (!lost || winData || !game) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const checkAllLost = async () => {
      try {
        const cutoff = new Date(Date.now() - 15_000).toISOString();
        const { data } = await supabase
          .from('online_players')
          .select('name, progress')
          .gte('last_seen', cutoff);
        if (!data) return;

        const someoneStillPlaying = data.some(p => {
          if (p.name === playerName) return false;
          const prog = Array.isArray(p.progress) ? p.progress : [];
          return prog.length > 0 && prog.length < MAX_GUESSES;
        });

        if (!someoneStillPlaying) {
          if (interval) clearInterval(interval);

          // Save to history (no winner)
          saveToHistory(game.id, game.word, null, guessesRef.current, false, true);

          await supabase
            .from('games')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .eq('id', game.id)
            .eq('status', 'active');

          const newWord = getRandomWord();
          const { data: newGame, error: insertError } = await supabase
            .from('games')
            .insert({ word: newWord, status: 'active' })
            .select()
            .single();

          let nextGame = newGame;
          if (insertError) {
            const { data: existing } = await supabase
              .from('games').select('*').eq('status', 'active')
              .order('started_at', { ascending: false }).limit(1).single();
            nextGame = existing;
          }
          if (nextGame) {
            startCountdown(nextGame, '', 0, game.word, false);
          }
        }
      } catch (err) {
        console.error('[allLost] polling error:', err);
      }
    };

    const timeout = setTimeout(() => {
      checkAllLost();
      interval = setInterval(checkAllLost, 4000);
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [lost, winData, game, playerName, startCountdown, saveToHistory]);

  /* ── Victoire ── */
  const handleWin = useCallback(async (guessCount: number) => {
    if (!game || !playerNameRef.current) return;
    setGameOver(true);
    sounds.playWin();
    vibrateWin();
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
        console.warn('[handleWin] Game already completed');
        return;
      }
      const payload: WonPayload = {
        winner_name: playerNameRef.current,
        winner_guesses: guessCount,
        word: game.word,
        new_game: data.new_game,
      };
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
    setLostWord(word);
    sounds.playLose();
  }, []);

  /* ── Soumettre un essai ── */
  const submitGuess = useCallback(() => {
    if (!game || gameOver || currentGuess.length !== WORD_LENGTH || winData) return;

    if (!isValidWord(currentGuess) && currentGuess !== game.word) {
      showToast('Mot non reconnu');
      sounds.playInvalidWord();
      vibrateError();
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    vibrateSubmit();
    const result = evaluateGuess(currentGuess, game.word);
    const newGuesses = [...guesses, result];
    setGuesses(newGuesses);
    setCurrentGuess('');
    setCurrentRow(r => r + 1);

    // Play tile flip sounds
    sounds.playTileRow(WORD_LENGTH);

    // Sauvegarder la progression dans la DB
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
    if (key === '⌫' || key === 'Backspace') {
      sounds.playBackspace();
      vibrateKey();
      setCurrentGuess(g => g.slice(0, -1));
    } else if (key === 'ENTER' || key === 'Enter') {
      submitGuess();
    } else if (/^[A-Za-z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
      sounds.playKeyClick();
      vibrateKey();
      setCurrentGuess(g => g + key.toUpperCase());
    }
  }, [gameOver, winData, currentGuess, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ne pas capturer les touches quand on tape dans un input (ex: chat)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      handleKey(e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  /* ── Mute toggle ── */
  const handleToggleMute = useCallback(() => {
    const newMuted = sounds.toggleMuted();
    setMuted(newMuted);
  }, []);

  if (!playerName) {
    return (
      <NameModal onConfirm={(name) => {
        localStorage.setItem('wordle_name', name);
        setPlayerName(name);
      }} />
    );
  }

  const keyStates = buildKeyboardStates(guesses);
  const myProgress = guesses.map(row => row.map(t => t.state));

  return (
    <div className="page">
      <Header
        playerName={playerName}
        onlineCount={connectedPlayers.length}
        onToggleSidebar={() => setSidebarOpen(o => !o)}
        sidebarOpen={sidebarOpen}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
      <div className="layout">
        <div className="game-area">
          <main className="main">
            {toast && <Toast message={toast} />}
            <Board guesses={guesses} currentGuess={currentGuess} currentRow={currentRow} shake={shake} />
            {lostWord && !winData && (
              <div className="loss-banner">
                <p className="loss-banner__label">Le mot était</p>
                <p className="loss-banner__word">{lostWord}</p>
                <p className="loss-banner__sub">⏳ En attente du prochain mot…</p>
              </div>
            )}
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
          chatMessages={chatMessages}
          onSendChat={sendChatMessage}
          unreadChat={unreadChat}
          onChatSeen={() => setUnreadChat(0)}
          gameHistory={gameHistory}
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
