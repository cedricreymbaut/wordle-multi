export interface Score {
  name: string;
  wins: number;
}

interface SidebarProps {
  connectedPlayers: string[];
  scores: Score[];
  currentPlayer: string;
  myProgress: string[][];
  playerProgress: Record<string, string[][]>;
  isOpen: boolean;
  onToggle: () => void;
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
}: SidebarProps) {
  return (
    <>
      {/* Bouton toggle (mobile) */}
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={isOpen ? 'Fermer le panel' : 'Ouvrir le panel'}
      >
        <span className="sidebar-toggle__icon">👥</span>
        {connectedPlayers.length > 0 && (
          <span className="sidebar-toggle__badge">{connectedPlayers.length}</span>
        )}
      </button>

      {/* Overlay mobile */}
      {isOpen && <div className="sidebar-backdrop" onClick={onToggle} />}

      <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>

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
                  <span className="score-item__wins">{s.wins}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </>
  );
}
