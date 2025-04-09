import React, { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { GameState } from '@shared/types';

interface ChessBoardProps {
  gameState: GameState;
  boardOrientation: 'white' | 'black';
}

export function ChessBoard({ gameState, boardOrientation }: ChessBoardProps) {
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);

  // Update last move highlight whenever the gameState changes
  useEffect(() => {
    console.log('Current FEN in ChessBoard:', gameState.fen); // Debug FEN
    if (gameState.history.length === 0 || gameState.currentMoveIndex < 0) {
      setLastMove(null);
      return;
    }

    const currentMove = gameState.history[gameState.currentMoveIndex];
    if (currentMove) {
      setLastMove([currentMove.from, currentMove.to]);
    } else {
      setLastMove(null);
    }
  }, [gameState]);

  // Custom style for the chess board
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  
  // Apply highlight style to the last move squares
  if (lastMove) {
    customSquareStyles[lastMove[0]] = {
      backgroundColor: 'rgba(255, 255, 0, 0.3)',
    };
    customSquareStyles[lastMove[1]] = {
      backgroundColor: 'rgba(255, 255, 0, 0.3)',
    };
  }

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <Chessboard
        id="chess-board"
        position={gameState.fen}
        boardOrientation={boardOrientation}
        customSquareStyles={customSquareStyles}
        boardWidth={window.innerWidth < 600 ? window.innerWidth - 40 : 600}
        areArrowsAllowed={false}
        customDarkSquareStyle={{ backgroundColor: '#769656' }}
        customLightSquareStyle={{ backgroundColor: '#EEEED2' }}
        key={gameState.fen} 
      />
    </div>
  );
}
