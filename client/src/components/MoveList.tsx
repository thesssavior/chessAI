import React from 'react';
import { formatMoveList } from '@/lib/chessUtils';
import { ChessMove } from '@shared/types';

interface MoveListProps {
  history: ChessMove[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  result?: string;
}

export function MoveList({ history, currentMoveIndex, onMoveClick, result }: MoveListProps) {
  const formattedMoves = formatMoveList(history);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3 className="text-lg font-medium">Move History</h3>
        {result && (
          <div>
            <span className="text-sm text-neutral-300 font-medium">
              Result: {result}
            </span>
          </div>
        )}
      </div>
      
      <div className="move-list h-[250px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-12 pb-2 text-left font-medium text-neutral-400">#</th>
              <th className="pb-2 text-left font-medium text-neutral-400">White</th>
              <th className="pb-2 text-left font-medium text-neutral-400">Black</th>
            </tr>
          </thead>
          <tbody>
            {formattedMoves.map((move, idx) => (
              <tr key={idx}>
                <td className="py-1 pr-2 text-neutral-300">{move.number}</td>
                <td className="py-1 pr-4">
                  {move.white && (
                    <button
                      className={`hover:bg-neutral-100 px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary ${
                        currentMoveIndex === idx * 2 ? 'bg-primary bg-opacity-10' : ''
                      }`}
                      onClick={() => onMoveClick(idx * 2)}
                    >
                      {move.white}
                    </button>
                  )}
                </td>
                <td className="py-1">
                  {move.black && (
                    <button
                      className={`hover:bg-neutral-100 px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-primary ${
                        currentMoveIndex === idx * 2 + 1 ? 'bg-primary bg-opacity-10' : ''
                      }`}
                      onClick={() => onMoveClick(idx * 2 + 1)}
                    >
                      {move.black}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
