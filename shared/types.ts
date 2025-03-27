// Game metadata from PGN
export interface GameMetadata {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  result?: string;
  [key: string]: string | undefined;
}

// Chess move structure
export interface ChessMove {
  color: 'w' | 'b';
  piece: string;
  from: string;
  to: string;
  san: string;  // Standard Algebraic Notation
  flags?: string;
  promotion?: string;
  captured?: string;
}

// Types for analysis requests
export interface AnalysisRequest {
  fen: string;
  pgn: string;
  currentMoveNumber: number;
  question?: string;
}

// Types for analysis responses
export interface AnalysisResponse {
  analysis: string;
  suggestedMoves?: string[];
}

// Chat message format
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Game state interface for sharing across components
export interface GameState {
  pgn: string;
  fen: string;
  metadata: GameMetadata;
  history: ChessMove[];
  currentMoveIndex: number;
}
