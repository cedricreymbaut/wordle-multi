export interface GameHistoryEntry {
  gameId: string;
  word: string;
  winnerName: string | null;
  myGuesses: string[][];   // TileState[][] saved as strings
  won: boolean;
  lost: boolean;
  timestamp: string;
}

interface GameHistoryProps {
  entries: GameHistoryEntry[];
}

const STATE_EMOJI: Record<string, string> = {
  correct: '🟢',
  present: '🟡',
  absent:  '🔴',
};

export function GameHistory({ entries }: GameHistoryProps) {
  if (entries.length === 0) {
    return <p className="sidebar-empty">Aucune partie terminée</p>;
  }

  return (
    <div className="history">
      {entries.map((entry) => (
        <div key={entry.gameId} className="history__item">
          <div className="history__header">
            <span className="history__word">{entry.word}</span>
            {entry.won ? (
              <span className="history__badge history__badge--win">Gagné ✓</span>
            ) : entry.winnerName ? (
              <span className="history__badge history__badge--loss">{entry.winnerName}</span>
            ) : (
              <span className="history__badge history__badge--none">Aucun</span>
            )}
          </div>
          {entry.myGuesses.length > 0 && (
            <div className="history__grid">
              {entry.myGuesses.map((row, i) => (
                <div key={i} className="history__row">
                  {row.map((state, j) => (
                    <span key={j}>{STATE_EMOJI[state] ?? '⬜'}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
