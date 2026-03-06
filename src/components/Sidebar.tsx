import { useState } from 'react';
import { Chat } from './Chat';
import { GameHistory } from './GameHistory';
import type { ChatMessage, GameHistoryEntry } from '../types';

export interface Score {
  name: string;
  wins: number;
  streak: number;
}

type TabId = 'players' | 'chat' | 'history';

interface SidebarProps {
  connectedPlayers: string[];
  scores: Score[];
  currentPlayer: string;
  myProgress: string[][];
  playerProgress: Record<string, string[][]>;
  isOpen: boolean;
  onToggle: () => void;
  // Chat
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  unreadChat: number;
  onChatSeen: () => void;
  // History
  gameHistory: GameHistoryEntry[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

const STATE_EMOJI: Record<string, string> = {
  correct: '🟢',
  present: '🟡',
  absent:  '🔴',
};

function ProgressRows({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="player-progress">
      {rows.map((row, i) => (
        <div key={i} className="player-progress-row">
          {row.map((state, j) => (
            <span key={j}>{STATE_EMOJI[state] ?? '⬜'}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Sidebar({
  connectedPlayers,
  scores,
  currentPlayer,
  myProgress,
  playerProgress,
  isOpen,
  onToggle,
  chatMessages,
  onSendChat,
  unreadChat,
  onChatSeen,
  gameHistory,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>('players');

  const handleTabClick = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === 'chat') onChatSeen();
  };

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && <div className="sidebar-backdrop" onClick={onToggle} />}

      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>

        {/* ── Tabs ── */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab${activeTab === 'players' ? ' sidebar-tab--active' : ''}`}
            onClick={() => handleTabClick('players')}
          >
            👥 Joueurs
          </button>
          <button
            className={`sidebar-tab${activeTab === 'chat' ? ' sidebar-tab--active' : ''}`}
            onClick={() => handleTabClick('chat')}
          >
            💬 Chat
            {unreadChat > 0 && activeTab !== 'chat' && (
              <span className="sidebar-tab__badge">{unreadChat}</span>
            )}
          </button>
          <button
            className={`sidebar-tab${activeTab === 'history' ? ' sidebar-tab--active' : ''}`}
            onClick={() => handleTabClick('history')}
          >
            📜 Historique
          </button>
        </div>

        {/* ── Tab content ── */}
        <div className="sidebar-content">

          {/* ─ Joueurs ─ */}
          {activeTab === 'players' && (
            <>
              {/* Joueurs en ligne */}
              <section className="sidebar-section">
                <h3 className="sidebar-section__title">
                  <span className="online-dot" />
                  En ligne
                  <span className="sidebar-section__count">{connectedPlayers.length}</span>
                </h3>

                {connectedPlayers.length === 0 ? (
                  <p className="sidebar-empty">Aucun joueur connecté</p>
                ) : (
                  <ul className="player-list">
                    {connectedPlayers.map((name) => {
                      const isMe = name === currentPlayer;
                      const rows = isMe ? myProgress : (playerProgress[name] ?? []);
                      return (
                        <li
                          key={name}
                          className={`player-item${isMe ? ' player-item--me' : ''}`}
                        >
                          <div className="player-item__header">
                            <span className="player-item__dot" />
                            <span className="player-item__name">{name}</span>
                            {isMe && <span className="player-item__tag">toi</span>}
                          </div>
                          <ProgressRows rows={rows} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Classement */}
              <section className="sidebar-section">
                <h3 className="sidebar-section__title">
                  🏆 Classement
                </h3>

                {scores.length === 0 ? (
                  <p className="sidebar-empty">Aucune victoire encore…</p>
                ) : (
                  <ol className="score-list">
                    {scores.map((s, i) => (
                      <li
                        key={s.name}
                        className={`score-item${s.name === currentPlayer ? ' score-item--me' : ''}`}
                      >
                        <span className="score-item__rank">
                          {MEDALS[i] ?? `${i + 1}.`}
                        </span>
                        <span className="score-item__name">{s.name}</span>
                        {s.streak >= 2 && (
                          <span className="score-item__streak" title={`${s.streak} victoires d'affilée`}>
                            🔥{s.streak}
                          </span>
                        )}
                        <span className="score-item__wins">{s.wins}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}

          {/* ─ Chat ─ */}
          {activeTab === 'chat' && (
            <Chat
              messages={chatMessages}
              onSend={onSendChat}
              currentPlayer={currentPlayer}
            />
          )}

          {/* ─ Historique ─ */}
          {activeTab === 'history' && (
            <section className="sidebar-section">
              <h3 className="sidebar-section__title">
                📜 Dernières parties
              </h3>
              <GameHistory entries={gameHistory} />
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
