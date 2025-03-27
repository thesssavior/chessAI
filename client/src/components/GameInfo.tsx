import React from 'react';
import { GameMetadata } from '@shared/types';

interface GameInfoProps {
  metadata: GameMetadata;
}

export function GameInfo({ metadata }: GameInfoProps) {
  return (
    <div className="bg-white p-4 rounded shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between mb-2">
        <div className="mb-2 sm:mb-0">
          <span className="font-medium">White:</span>{' '}
          <span>{metadata.white || 'Unknown'}</span>
        </div>
        <div>
          <span className="font-medium">Black:</span>{' '}
          <span>{metadata.black || 'Unknown'}</span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between">
        <div className="mb-2 sm:mb-0">
          <span className="font-medium">Event:</span>{' '}
          <span>{metadata.event || 'Unknown'}</span>
        </div>
        <div>
          <span className="font-medium">Date:</span>{' '}
          <span>{metadata.date || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
}
