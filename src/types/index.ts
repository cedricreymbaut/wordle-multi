export type TileState = 'correct' | 'present' | 'absent' | 'empty' | 'active';

export interface TileData {
  letter: string;
  state: TileState;
}

export interface Game {
  id: string;
  word: string;
  status: 'active' | 'completed';
  winner_name: string | null;
  winner_guesses: number | null;
  started_at: string;
  ended_at: string | null;
}

export interface CompleteGameResult {
  success: boolean;
  message?: string;
  new_game?: Game;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface GameHistoryEntry {
  gameId: string;
  word: string;
  winnerName: string | null;
  myGuesses: string[][];
  won: boolean;
  lost: boolean;
  timestamp: string;
}
