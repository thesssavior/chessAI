import React, { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { GameState, ChessMove } from '@shared/types';

interface PlayableChessBoardProps {
  gameState: GameState;
  boardOrientation: 'white' | 'black';
  onMove: (move: ChessMove, newFen: string) => void;
  allowMoves: boolean;
}

export function PlayableChessBoard({ 
  gameState, 
  boardOrientation, 
  onMove,
  allowMoves = true
}: PlayableChessBoardProps) {
  const [chess, setChess] = useState<Chess>(new Chess());
  const [lastMove, setLastMove] = useState<[string, string] | null>(null);

  // Update the board position when the gameState changes
  useEffect(() => {
    const newChess = new Chess();
    try {
      if (gameState.fen) {
        newChess.load(gameState.fen);
      }
      setChess(newChess);
    } catch (error) {
      console.error('Invalid FEN:', error);
    }

    // Update last move highlight
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

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (!allowMoves) return false;
    
    const newChess = new Chess(chess.fen());
    
    try {
      const moveOptions = {
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      };
      
      const move = newChess.move(moveOptions);
      
      if (move) {
        setChess(newChess);
        
        const newMove: ChessMove = {
          color: move.color,
          piece: move.piece,
          from: move.from,
          to: move.to,
          san: move.san,
          flags: move.flags,
          promotion: move.promotion,
          captured: move.captured,
        };
        
        setLastMove([sourceSquare, targetSquare]);
        
        // Notify parent with move and new FEN
        onMove(newMove, newChess.fen());
        
        return true;
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
    
    return false;
  };
  
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
        position={chess.fen()}
        boardOrientation={boardOrientation}
        customSquareStyles={customSquareStyles}
        boardWidth={window.innerWidth < 600 ? window.innerWidth - 40 : 600}
        areArrowsAllowed={true}
        onPieceDrop={onDrop}
        customDarkSquareStyle={{ backgroundColor: '#769656' }}
        customLightSquareStyle={{ backgroundColor: '#EEEED2' }}
      />
    </div>
  );
}