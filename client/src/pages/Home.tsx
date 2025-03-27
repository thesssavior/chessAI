import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { BoardControls } from '@/components/BoardControls';
import { PGNInput } from '@/components/PGNInput';
import { GameInfo } from '@/components/GameInfo';
import { AnalysisTabs } from '@/components/AnalysisTabs';
import { parsePgn, getGameHistory, navigateToPosition, generateGameId } from '@/lib/chessUtils';
import { GameState, GameMetadata } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

// Default empty game state
const defaultGameState: GameState = {
  pgn: '',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
  metadata: {},
  history: [],
  currentMoveIndex: -1
};

export default function Home() {
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [gameId, setGameId] = useState<string>(generateGameId());
  
  // Set up keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevMove();
      } else if (e.key === 'ArrowRight') {
        handleNextMove();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);
  
  const handlePgnSubmit = async (pgn: string) => {
    try {
      // Parse the PGN
      const parsedGame = parsePgn(pgn);
      if (!parsedGame) {
        throw new Error('Failed to parse PGN');
      }
      
      const { chess, metadata } = parsedGame;
      const history = getGameHistory(chess);
      
      // Create new game state
      const newGameState: GameState = {
        pgn,
        fen: chess.fen(),
        metadata,
        history,
        currentMoveIndex: history.length - 1 // Start at the last move
      };
      
      setGameState(newGameState);
      
      // Generate a new game ID
      const newGameId = generateGameId();
      setGameId(newGameId);
      
      // Save the game to the backend
      await apiRequest('POST', '/api/games', {
        pgn,
        metadata
      });
    } catch (error) {
      console.error('Error loading PGN:', error);
      // We would show an error toast here, but we don't want to add dependencies
      alert('Failed to load PGN: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };
  
  const handleFirstMove = () => {
    setGameState(prevState => navigateToPosition(prevState, -1));
  };
  
  const handlePrevMove = () => {
    setGameState(prevState => {
      const newIndex = Math.max(-1, prevState.currentMoveIndex - 1);
      return navigateToPosition(prevState, newIndex);
    });
  };
  
  const handleNextMove = () => {
    setGameState(prevState => {
      const newIndex = Math.min(prevState.history.length - 1, prevState.currentMoveIndex + 1);
      return navigateToPosition(prevState, newIndex);
    });
  };
  
  const handleLastMove = () => {
    setGameState(prevState => {
      const lastIndex = prevState.history.length - 1;
      return navigateToPosition(prevState, lastIndex);
    });
  };
  
  const handleFlipBoard = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
  };
  
  const handleMoveClick = (index: number) => {
    setGameState(prevState => navigateToPosition(prevState, index));
  };

  return (
    <div className="container mx-auto px-4 py-6 min-h-screen">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-400 mb-4 md:mb-0">
          Chess Moves Explainer AI
        </h1>
        <PGNInput onSubmit={handlePgnSubmit} />
      </header>
      
      <main className="flex flex-col lg:flex-row gap-6">
        {/* Left panel - Chess board and controls */}
        <div className="w-full lg:w-1/2">
          <div className="mb-6">
            <ChessBoard
              gameState={gameState}
              boardOrientation={boardOrientation}
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
          
          <GameInfo metadata={gameState.metadata} />
        </div>
        
        {/* Right panel - Analysis and Chat */}
        <div className="w-full lg:w-1/2">
          <AnalysisTabs
            gameState={gameState}
            onMoveClick={handleMoveClick}
            gameId={gameId}
          />
        </div>
      </main>
    </div>
  );
}
