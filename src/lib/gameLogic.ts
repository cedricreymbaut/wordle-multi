import type { TileData, TileState } from '../types';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export function evaluateGuess(guess: string, answer: string): TileData[] {
  const result: TileData[] = Array(WORD_LENGTH).fill(null).map((_, i) => ({
    letter: guess[i],
    state: 'absent' as TileState,
  }));

  const answerLetters = answer.split('');
  const guessLetters = guess.split('');

  // First pass: mark correct positions
  guessLetters.forEach((letter, i) => {
    if (letter === answerLetters[i]) {
      result[i].state = 'correct';
      answerLetters[i] = '#'; // consumed
    }
  });

  // Second pass: mark present letters
  guessLetters.forEach((letter, i) => {
    if (result[i].state === 'correct') return;
    const idx = answerLetters.indexOf(letter);
    if (idx !== -1) {
      result[i].state = 'present';
      answerLetters[idx] = '#'; // consumed
    }
  });

  return result;
}

export function buildKeyboardStates(guesses: TileData[][]): Record<string, TileState> {
  const states: Record<string, TileState> = {};
  const priority: Record<TileState, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    empty: 0,
    active: 0,
  };

  guesses.forEach(row => {
    row.forEach(tile => {
      const current = states[tile.letter];
      if (!current || priority[tile.state] > priority[current]) {
        states[tile.letter] = tile.state;
      }
    });
  });

  return states;
}
