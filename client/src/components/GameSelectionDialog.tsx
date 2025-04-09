import React, { useState } from 'react';
import { format } from 'date-fns';
import { Game } from '@shared/types';

interface GameSelectionDialogProps {
  games: Game[];
  onSelect: (game: Game) => void;
  onClose: () => void;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  hasMore: boolean;
}

export function GameSelectionDialog({ 
  games, 
  onSelect, 
  onClose, 
  onLoadMore,
  isLoadingMore,
  hasMore 
}: GameSelectionDialogProps) {
  // Ref for intersection observer
  const observerRef = React.useRef<IntersectionObserver>();
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // Set up intersection observer for infinite scroll
  React.useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Select a Game</h2>
        <div className="space-y-4">
          {games.map((game, index) => (
            <button
              key={`${game.url}-${index}`}
              className="w-full text-left p-4 border rounded hover:bg-gray-50 transition-colors"
              onClick={() => onSelect(game)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">
                  {game.white} vs {game.black}
                </span>
                <span className="text-sm text-gray-500">
                  {format(new Date(game.timestamp * 1000), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                Result: {game.result}
              </div>
            </button>
          ))}
          
          {/* Loading indicator and intersection observer target */}
          <div ref={loadMoreRef} className="py-4 text-center">
            {isLoadingMore ? (
              <div className="text-gray-500">Loading more games...</div>
            ) : hasMore ? (
              <div className="text-gray-500">Scroll for more games</div>
            ) : (
              <div className="text-gray-500">No more games to load</div>
            )}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 