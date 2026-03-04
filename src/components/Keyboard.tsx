import type { TileState } from '../types';

interface KeyboardProps {
  onKey: (key: string) => void;
  keyStates: Record<string, TileState>;
}

const ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['ENTER', 'W', 'X', 'C', 'V', 'B', 'N', '⌫'],
];

interface KeyProps {
  value: string;
  state?: TileState;
  onClick: () => void;
}

function Key({ value, state, onClick }: KeyProps) {
  const isSpecial = value === 'ENTER' || value === '⌫';
  return (
    <button
      className={`key${state ? ` key--${state}` : ''}${isSpecial ? ' key--wide' : ''}`}
      onClick={onClick}
      aria-label={value}
    >
      {value}
    </button>
  );
}

export function Keyboard({ onKey, keyStates }: KeyboardProps) {
  return (
    <div className="keyboard">
      {ROWS.map((row, i) => (
        <div key={i} className="keyboard-row">
          {row.map(key => (
            <Key
              key={key}
              value={key}
              state={keyStates[key]}
              onClick={() => onKey(key)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
