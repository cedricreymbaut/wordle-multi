interface HeaderProps {
  playerName: string;
  onlineCount: number;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

export function Header({
  playerName,
  onlineCount,
  onToggleSidebar,
  sidebarOpen,
  muted,
  onToggleMute,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__inner">
        <h1 className="header__title">WORDLE</h1>
        <span className="header__badge">MULTI</span>
      </div>

      <div className="header__meta">
        {playerName && (
          <p className="header__player">Joueur : <strong>{playerName}</strong></p>
        )}

        {/* Mute toggle */}
        <button
          className="header__mute-btn"
          onClick={onToggleMute}
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
          title={muted ? 'Son coupé' : 'Son activé'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {/* Bouton sidebar — visible uniquement sur mobile */}
        <button
          className={`header__sidebar-btn${sidebarOpen ? ' header__sidebar-btn--active' : ''}`}
          onClick={onToggleSidebar}
          aria-label="Joueurs & classement"
        >
          👥
          {onlineCount > 0 && (
            <span className="header__online-badge">{onlineCount}</span>
          )}
        </button>
      </div>
    </header>
  );
}
