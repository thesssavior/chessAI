import { Chess } from "chess.js";
import { GameMetadata, ChessMove, GameState } from "@shared/types";

// Parse a PGN string and extract game info
export function parsePgn(pgn: string): { chess: Chess, metadata: GameMetadata } | null {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    
    // Extract metadata
    const metadata: GameMetadata = {
      event: chess.header().Event,
      site: chess.header().Site,
      date: chess.header().Date,
      round: chess.header().Round,
      white: chess.header().White,
      black: chess.header().Black,
      result: chess.header().Result,
    };
    
    return { chess, metadata };
  } catch (error) {
    console.error("Error parsing PGN:", error);
    return null;
  }
}

// Get the full history of moves
export function getGameHistory(chess: Chess): ChessMove[] {
  return chess.history({ verbose: true }) as ChessMove[];
}

// Get the current position FEN
export function getCurrentFen(chess: Chess): string {
  return chess.fen();
}

// Navigate to a specific position in the game
export function navigateToPosition(gameState: GameState, moveIndex: number): GameState {
  // Create a new Chess instance and load the original game
  const chess = new Chess();
  chess.loadPgn(gameState.pgn);
  
  // Clear all moves
  while (chess.undo() !== null) {} 
  
  // Play moves up to the desired index
  const movesToPlay = Math.max(0, Math.min(moveIndex, gameState.history.length - 1)) + 1;
  const history = getGameHistory(chess);
  
  // Reset chess and replay the moves
  chess.reset();
  for (let i = 0; i < movesToPlay; i++) {
    if (i < history.length) {
      try {
        chess.move({
          from: history[i].from,
          to: history[i].to,
          promotion: history[i].promotion
        });
      } catch (e) {
        console.error(`Failed to replay move: ${i}`, e);
        break;
      }
    }
  }
  
  return {
    ...gameState,
    fen: chess.fen(),
    currentMoveIndex: moveIndex
  };
}

// Get the current move number and side to move
export function getCurrentMoveDisplay(gameState: GameState): string {
  // In chess, each complete move consists of white+black moving
  // So move 1 is after both white and black moved once
  const fullMoveNumber = Math.floor(gameState.currentMoveIndex / 2) + 1;
  const side = gameState.currentMoveIndex % 2 === 0 ? "White" : "Black";
  const totalMoves = Math.ceil(gameState.history.length / 2);
  
  return `Move ${fullMoveNumber} (${side} to move) of ${totalMoves}`;
}

// Format moves for display in the move list
export function formatMoveList(history: ChessMove[]): Array<{ number: number, white?: string, black?: string }> {
  const formattedMoves = [];
  
  for (let i = 0; i < history.length; i += 2) {
    formattedMoves.push({
      number: Math.floor(i / 2) + 1,
      white: history[i]?.san,
      black: history[i + 1]?.san
    });
  }
  
  return formattedMoves;
}

// Generate a unique game ID
export function generateGameId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}
