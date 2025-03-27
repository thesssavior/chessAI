import React from 'react';
import { GameState } from '@shared/types';
import { getCurrentMoveDisplay } from '@/lib/chessUtils';

interface BoardControlsProps {
  gameState: GameState;
  onFirstMove: () => void;
  onPrevMove: () => void;
  onNextMove: () => void;
  onLastMove: () => void;
  onFlipBoard: () => void;
}

export function BoardControls({
  gameState,
  onFirstMove,
  onPrevMove,
  onNextMove,
  onLastMove,
  onFlipBoard,
}: BoardControlsProps) {
  // Check if we're at the beginning or end of the game
  const isAtStart = gameState.currentMoveIndex < 0;
  const isAtEnd = gameState.currentMoveIndex >= gameState.history.length - 1;
  const moveDisplay = getCurrentMoveDisplay(gameState);

  return (
    <div className="flex justify-center items-center gap-4 mb-6">
      <button
        className="p-2 rounded-full hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="First move"
        onClick={onFirstMove}
        disabled={isAtStart}
      >
        <span className="material-icons">first_page</span>
      </button>
      
      <button
        className="p-2 rounded-full hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous move"
        onClick={onPrevMove}
        disabled={isAtStart}
      >
        <span className="material-icons">navigate_before</span>
      </button>
      
      <div className="text-neutral-400 font-medium mx-2">
        {moveDisplay}
      </div>
      
      <button
        className="p-2 rounded-full hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next move"
        onClick={onNextMove}
        disabled={isAtEnd}
      >
        <span className="material-icons">navigate_next</span>
      </button>
      
      <button
        className="p-2 rounded-full hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Last move"
        onClick={onLastMove}
        disabled={isAtEnd}
      >
        <span className="material-icons">last_page</span>
      </button>
      
      <button
        className="flex items-center p-2 rounded-full hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary ml-2"
        aria-label="Flip board"
        onClick={onFlipBoard}
      >
        <span className="material-icons">swap_vert</span>
      </button>
    </div>
  );
}
