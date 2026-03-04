interface HeaderProps {
  playerName: string;
}

export function Header({ playerName }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__inner">
        <h1 className="header__title">WORDLE</h1>
        <span className="header__badge">MULTI</span>
      </div>
      {playerName && (
        <p className="header__player">Joueur : <strong>{playerName}</strong></p>
      )}
    </header>
  );
}
