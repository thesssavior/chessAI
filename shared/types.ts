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

// Engine evaluation data
export interface EngineEvaluation {
  score: string;
  bestMove: string;
  bestLine?: string;
  depth: number;
}

// Types for analysis requests
export interface AnalysisRequest {
  fen: string;
  pgn: string;
  currentMoveNumber: number;
  question?: string;
  engineEvaluation?: EngineEvaluation;
  evaluations?: number[];
  stockfishAnalysis?: string;
  detailedEvaluation?: any; // Detailed position metrics from Stockfish
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

// Chess.com game data
export interface Game {
  pgn: string;
  white: string;
  black: string;
  result: string;
  timestamp: number;
  url?: string;
}
