import type { TileData } from '../types';
import { Tile } from './Tile';
import { WORD_LENGTH, MAX_GUESSES } from '../lib/gameLogic';

interface BoardProps {
  guesses: TileData[][];
  currentGuess: string;
  currentRow: number;
  shake: boolean;
}

export function Board({ guesses, currentGuess, currentRow, shake }: BoardProps) {
  return (
    <div className="board">
      {Array(MAX_GUESSES).fill(null).map((_, rowIdx) => {
        const isCurrentRow = rowIdx === currentRow;
        const guess = guesses[rowIdx];

        return (
          <div
            key={rowIdx}
            className={`board-row${isCurrentRow && shake ? ' board-row--shake' : ''}`}
          >
            {Array(WORD_LENGTH).fill(null).map((_, colIdx) => {
              if (guess) {
                return (
                  <Tile
                    key={colIdx}
                    letter={guess[colIdx].letter}
                    state={guess[colIdx].state}
                    delay={colIdx * 80}
                  />
                );
              }
              if (isCurrentRow) {
                const letter = currentGuess[colIdx] || '';
                return (
                  <Tile
                    key={colIdx}
                    letter={letter}
                    state={letter ? 'active' : 'empty'}
                  />
                );
              }
              return <Tile key={colIdx} letter="" state="empty" />;
            })}
          </div>
        );
      })}
    </div>
  );
}
