import { GameState } from "@shared/types";
import { getGameHistory, navigateToPosition, parsePgn } from "./lib/chessUtils";

const testPgn = '1. e4 e5 2. Nf3 Nc6';
const parsed = parsePgn(testPgn);
const initialState: GameState = {
  pgn: testPgn,
  fen: parsed!.chess.fen(),
  metadata: parsed!.metadata,
  history: getGameHistory(parsed!.chess),
  currentMoveIndex: -1,
};

console.log(navigateToPosition(initialState, -1).fen); // Starting position
console.log(navigateToPosition(initialState, 0).fen);  // After 1. e4
console.log(navigateToPosition(initialState, 1).fen);  // After 1...e5