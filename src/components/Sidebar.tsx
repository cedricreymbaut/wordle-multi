export interface Score {
  name: string;
  wins: number;
}

interface SidebarProps {
  connectedPlayers: string[];
  scores: Score[];
  currentPlayer: string;
  isOpen: boolean;
  onToggle: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function Sidebar({ connectedPlayers, scores, currentPlayer, isOpen, onToggle }: SidebarProps) {
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
              {connectedPlayers.map((name) => (
                <li
                  key={name}
                  className={`player-item${name === currentPlayer ? ' player-item--me' : ''}`}
                >
                  <span className="player-item__dot" />
                  <span className="player-item__name">{name}</span>
                  {name === currentPlayer && (
                    <span className="player-item__tag">toi</span>
                  )}
                </li>
              ))}
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
