import React, { useState } from 'react';

interface PGNInputProps {
  onSubmit: (pgn: string) => void;
}

export function PGNInput({ onSubmit }: PGNInputProps) {
  const [pgnInput, setPgnInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!pgnInput.trim()) {
      setError('Please enter a PGN');
      return;
    }
    
    // Basic validation - check for some standard PGN tags
    const hasTags = /\[\s*\w+\s*"[^"]*"\s*\]/i.test(pgnInput);
    const hasMoves = /1\.\s*\w+/.test(pgnInput);
    
    if (!hasTags && !hasMoves) {
      setError('Invalid PGN format. Please check and try again.');
      return;
    }
    
    setError('');
    onSubmit(pgnInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="w-full md:w-auto">
      <div className="flex">
        <input
          type="text"
          placeholder="Paste PGN here..."
          className="px-4 py-2 border border-neutral-200 rounded-l focus:outline-none focus:ring-2 focus:ring-primary w-full md:w-80"
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          className="bg-primary text-white px-4 py-2 rounded-r hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={handleSubmit}
        >
          Load
        </button>
      </div>
      {error && (
        <div className="text-red-500 text-sm mt-1">{error}</div>
      )}
    </div>
  );
}
