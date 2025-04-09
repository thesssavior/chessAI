import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { PlayableChessBoard } from '@/components/PlayableChessBoard';
import { BoardControls } from '@/components/BoardControls';
import { PGNInput } from '@/components/PGNInput';
import { GameInfo } from '@/components/GameInfo';
import { AnalysisTabs } from '@/components/AnalysisTabs';
import { GameImporter } from '@/components/GameImporter';
import { parsePgn, getGameHistory, navigateToPosition, generateGameId } from '@/lib/chessUtils';
import { GameState, GameMetadata, ChessMove } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

const defaultGameState: GameState = {
  pgn: '',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  metadata: {},
  history: [],
  currentMoveIndex: -1,
};

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [gameId, setGameId] = useState<string>(generateGameId());
  const [temporaryBranch, setTemporaryBranch] = useState<{
    baseMoveIndex: number;
    moves: ChessMove[];
    fen: string;
  } | null>(null);
  const [displayFen, setDisplayFen] = useState(gameState.fen);

  // Handle moves made on the board
  const handleMove = (move: ChessMove) => {
    const chess = new Chess();
    // Load the current position
    chess.load(displayFen);
    // Make the move to get the new FEN
    chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    const newFen = chess.fen();

    // If we already have a temporary branch, add to it
    if (temporaryBranch) {
      const updatedBranch = {
        ...temporaryBranch,
        moves: [...temporaryBranch.moves, move],
        fen: newFen
      };
      
      handleTemporaryBranchChange(updatedBranch);
      return;
    }
    
    // Check if we're not at the latest move in the main line
    if (gameState.currentMoveIndex < gameState.history.length - 1) {
      // We're making a move from a previous position, so create a temporary branch
      const newBranch = {
        baseMoveIndex: gameState.currentMoveIndex,
        moves: [move],
        fen: newFen
      };
      
      // Update the temporary branch
      handleTemporaryBranchChange(newBranch);
      return;
    }

    // Otherwise just add the move to main history
    setGameState((prevState) => {
      const newHistory = [...prevState.history, move];
      
      return {
        ...prevState,
        history: newHistory,
        currentMoveIndex: prevState.currentMoveIndex + 1,
        fen: newFen
      };
    });
  };

  // Navigation functions
  const handleFirstMove = () => {
    setTemporaryBranch(null);
    setGameState((prevState) => navigateToPosition(prevState, -1));
    setDisplayFen(gameState.fen);
  };

  const handlePrevMove = () => {
    if (temporaryBranch && gameState.currentMoveIndex === temporaryBranch.baseMoveIndex + 1) {
      setTemporaryBranch(null);
      setDisplayFen(getFenAtIndex(gameState, temporaryBranch.baseMoveIndex));
    } else {
      setGameState((prevState) => {
        const newIndex = Math.max(-1, prevState.currentMoveIndex - 1);
        const newState = navigateToPosition(prevState, newIndex);
        setDisplayFen(getFenAtIndex(newState, newIndex));
        return newState;
      });
    }
  };

  const handleNextMove = () => {
    setGameState((prevState) => {
      const newIndex = Math.min(prevState.history.length - 1, prevState.currentMoveIndex + 1);
      const newState = navigateToPosition(prevState, newIndex);
      setDisplayFen(getFenAtIndex(newState, newIndex));
      return newState;
    });
  };

  const handleLastMove = () => {
    setTemporaryBranch(null);
    setGameState((prevState) => {
      const lastIndex = prevState.history.length - 1;
      const newState = navigateToPosition(prevState, lastIndex);
      setDisplayFen(getFenAtIndex(newState, lastIndex));
      return newState;
    });
  };

  const handleFlipBoard = () => {
    setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  };

  const handleMoveClick = (index: number) => {
    // If we have a temporary branch and clicked on a main game move,
    // we should handle it differently based on where the move is
    if (temporaryBranch) {
      // Clicked on a move before the branch point - stay in main line
      if (index <= temporaryBranch.baseMoveIndex) {
        // Just navigate to the position in the main game
        setGameState((prevState) => {
          const newState = navigateToPosition(prevState, index);
          setDisplayFen(getFenAtIndex(newState, index));
          return newState;
        });
        return;
      }
      
      // Clicked on a move in the main line beyond the branch point
      // This means we're returning to the main line
      if (index > temporaryBranch.baseMoveIndex && index < gameState.history.length) {
        // Clear the temporary branch and go to the main game move
        setTemporaryBranch(null);
        setGameState((prevState) => {
          const newState = navigateToPosition(prevState, index);
          setDisplayFen(getFenAtIndex(newState, index));
          return newState;
        });
        return;
      }
    }
    
    // If no special case applies, just navigate to the position
    setGameState((prevState) => {
      // If moving to a main line position from a temporary branch, clear the branch
      if (temporaryBranch && index < gameState.history.length) {
        setTemporaryBranch(null);
      }
      
      const newState = navigateToPosition(prevState, index);
      setDisplayFen(getFenAtIndex(newState, index));
      return newState;
    });
  };

  // Updated handleTemporaryBranchChange function
  const handleTemporaryBranchChange = (branch: {
    baseMoveIndex: number;
    moves: ChessMove[];
    fen: string;
  } | null) => {
    // When setting a temporary branch, we're preserving the main game state
    // and just displaying a different branch of moves
    setTemporaryBranch(branch);
    
    if (branch) {
      // Update the display FEN to show the position from the branch
      setDisplayFen(branch.fen);
    } else {
      // If clearing the branch, go back to showing the main game position
      const mainGameFen = getFenAtIndex(gameState, gameState.currentMoveIndex);
      setDisplayFen(mainGameFen);
    }
  };

  // Helper to compute FEN at a given index
  const getFenAtIndex = (state: GameState, index: number) => {
    try {
      // Always start from the starting position
      const chess = new Chess();
      
      // Don't try to apply moves if we just want the initial position
      if (index < 0) {
        return chess.fen();
      }
      
      // Apply each move with error checking
      for (let i = 0; i <= Math.min(index, state.history.length - 1); i++) {
        const move = state.history[i];
        if (!move) continue;
        
        try {
          // Use from/to instead of SAN notation
          if (move.from && move.to) {
            const result = chess.move({
              from: move.from,
              to: move.to,
              promotion: move.promotion || undefined
            });
            
            if (!result) {
              console.warn(`Could not apply move from=${move.from}, to=${move.to} at index ${i}`);
            }
          } else if (move.san) {
            // Fallback to SAN if from/to not available (should not typically happen)
            const result = chess.move(move.san);
            if (!result) {
              console.warn(`Could not apply SAN move ${move.san} at index ${i}`);
            }
          }
        } catch (moveError) {
          console.warn(`Error applying move at index ${i}:`, moveError);
          // Continue with the current position rather than failing
        }
      }
      
      return chess.fen();
    } catch (error) {
      console.error('Error calculating FEN:', error);
      return state.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Return standard starting position as fallback
    }
  };

  // Handle PGN submission and game import
  const handlePgnSubmit = async (pgn: string) => {
    try {
      const parsedGame = parsePgn(pgn);
      if (!parsedGame) throw new Error('Failed to parse PGN');
      const { chess, metadata } = parsedGame;
      const history = getGameHistory(chess);
      const newGameState: GameState = {
        pgn,
        fen: chess.fen(),
        metadata,
        history,
        currentMoveIndex: -1,
      };
      setGameState(newGameState);
      setDisplayFen(chess.fen());
      const newGameId = generateGameId();
      setGameId(newGameId);
      await apiRequest('POST', '/api/games', { pgn, metadata });
    } catch (error) {
      console.error('Error loading PGN:', error);
      alert('Failed to load PGN: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleGameLoaded = (newGameState: GameState) => {
    setGameState(newGameState);
    setDisplayFen(newGameState.fen);
    const newGameId = generateGameId();
    setGameId(newGameId);
  };

  // Update displayFen when gameState or temporaryBranch changes
  useEffect(() => {
    if (temporaryBranch) {
      setDisplayFen(temporaryBranch.fen);
    } else {
      const newFen = getFenAtIndex(gameState, gameState.currentMoveIndex);
      setDisplayFen(newFen);
    }
  }, [gameState, temporaryBranch]);

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen">
      <header className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-400 mb-4 md:mb-0">
          Chess Moves Explainer AI
        </h1>
      </header>
      <main className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-1/2">
          <div className="mb-6">
            <PlayableChessBoard
              gameState={{
                ...gameState,
                fen: displayFen
              }}
              boardOrientation={boardOrientation}
              onMove={handleMove}
              allowMoves={true}
            />
          </div>
          <BoardControls
            gameState={gameState}
            onFirstMove={handleFirstMove}
            onPrevMove={handlePrevMove}
            onNextMove={handleNextMove}
            onLastMove={handleLastMove}
            onFlipBoard={handleFlipBoard}
          />
          <div className="mt-4 mb-4">
            <GameImporter onGameLoaded={handleGameLoaded} />
          </div>
          <GameInfo metadata={gameState.metadata} />
        </div>
        <div className="w-full lg:w-1/2">
          <AnalysisTabs
            gameState={gameState}
            onMoveClick={handleMoveClick}
            gameId={gameId}
            temporaryBranch={temporaryBranch}
            onTemporaryBranchChange={handleTemporaryBranchChange}
            onFenChange={setDisplayFen}
          />
        </div>
      </main>
    </div>
  );
}