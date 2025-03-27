import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { parsePgn } from '@/lib/chessUtils';
import { GameState, ChessMove } from '@shared/types';

interface GameImporterProps {
  onGameLoaded: (gameState: GameState) => void;
}

export function GameImporter({ onGameLoaded }: GameImporterProps) {
  const [chesscomUsername, setChesscomUsername] = useState('');
  const [lichessUsername, setLichessUsername] = useState('');
  const [lichessGameId, setLichessGameId] = useState('');
  const [chesscomGameUrl, setChesscomGameUrl] = useState('');
  const [importError, setImportError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImportFromChessCom = async () => {
    setIsLoading(true);
    setImportError('');
    
    try {
      let endpoint = '/api/import/chessdotcom';
      let params = {};
      
      if (chesscomUsername) {
        // Get recent games from a user
        params = { username: chesscomUsername };
      } else if (chesscomGameUrl) {
        // Get a specific game by URL
        let gameUrl = chesscomGameUrl;
        
        // Ensure the URL starts with https:// if not already
        if (!gameUrl.startsWith('http://') && !gameUrl.startsWith('https://')) {
          gameUrl = 'https://' + gameUrl;
        }
        
        // Make sure the URL is from chess.com
        if (!gameUrl.includes('chess.com')) {
          throw new Error('Please enter a valid Chess.com game URL');
        }
        
        params = { gameUrl };
      } else {
        throw new Error('Please enter a Chess.com username or game URL');
      }
      
      console.log('Importing from Chess.com with params:', params);
      const response = await apiRequest('GET', `${endpoint}?${new URLSearchParams(params)}`);
      const data = await response.json();
      
      if (data.pgn) {
        const parsedGame = parsePgn(data.pgn);
        if (parsedGame) {
          const { chess, metadata } = parsedGame;
          const gameState: GameState = {
            pgn: data.pgn,
            fen: chess.fen(),
            metadata,
            history: chess.history({ verbose: true }) as ChessMove[],
            currentMoveIndex: chess.history().length - 1
          };
          onGameLoaded(gameState);
        } else {
          throw new Error('Failed to parse game data');
        }
      } else {
        throw new Error('No game data found');
      }
    } catch (error) {
      console.error('Error importing from Chess.com:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportFromLichess = async () => {
    setIsLoading(true);
    setImportError('');
    
    try {
      let endpoint = '/api/import/lichess';
      let params = {};
      
      if (lichessUsername) {
        // Get recent games from a user
        params = { username: lichessUsername };
      } else if (lichessGameId) {
        // Get a specific game by ID
        params = { gameId: lichessGameId };
      } else {
        throw new Error('Please enter a Lichess username or game ID');
      }
      
      const response = await apiRequest('GET', `${endpoint}?${new URLSearchParams(params)}`);
      const data = await response.json();
      
      if (data.pgn) {
        const parsedGame = parsePgn(data.pgn);
        if (parsedGame) {
          const { chess, metadata } = parsedGame;
          const gameState: GameState = {
            pgn: data.pgn,
            fen: chess.fen(),
            metadata,
            history: chess.history({ verbose: true }) as ChessMove[],
            currentMoveIndex: chess.history().length - 1
          };
          onGameLoaded(gameState);
        } else {
          throw new Error('Failed to parse game data');
        }
      } else {
        throw new Error('No game data found');
      }
    } catch (error) {
      console.error('Error importing from Lichess:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewGame = () => {
    // Create an empty game state with starting position
    const emptyGameState: GameState = {
      pgn: '',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      metadata: {},
      history: [],
      currentMoveIndex: -1
    };
    
    onGameLoaded(emptyGameState);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Import Game</h2>
      
      <Tabs defaultValue="chessdotcom">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="chessdotcom">Chess.com</TabsTrigger>
          <TabsTrigger value="lichess">Lichess</TabsTrigger>
          <TabsTrigger value="new">New Game</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chessdotcom">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Chess.com Username
              </label>
              <Input
                value={chesscomUsername}
                onChange={(e) => setChesscomUsername(e.target.value)}
                placeholder="Enter username to import recent games"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Or Chess.com Game URL
              </label>
              <Input
                value={chesscomGameUrl}
                onChange={(e) => setChesscomGameUrl(e.target.value)}
                placeholder="e.g., https://www.chess.com/game/live/1234567890"
              />
            </div>
            
            <Button 
              onClick={handleImportFromChessCom}
              disabled={isLoading || (!chesscomUsername && !chesscomGameUrl)}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Import from Chess.com'}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="lichess">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Lichess Username
              </label>
              <Input
                value={lichessUsername}
                onChange={(e) => setLichessUsername(e.target.value)}
                placeholder="Enter username to import recent games"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Or Lichess Game ID
              </label>
              <Input
                value={lichessGameId}
                onChange={(e) => setLichessGameId(e.target.value)}
                placeholder="e.g., peSLojNe"
              />
            </div>
            
            <Button 
              onClick={handleImportFromLichess}
              disabled={isLoading || (!lichessUsername && !lichessGameId)}
              className="w-full"
            >
              {isLoading ? 'Loading...' : 'Import from Lichess'}
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="new">
          <div className="py-4 text-center">
            <p className="mb-4">Start a new game with the starting position</p>
            <Button onClick={handleStartNewGame} className="w-full">
              Start New Game
            </Button>
          </div>
        </TabsContent>
      </Tabs>
      
      {importError && (
        <div className="mt-4 p-2 bg-red-50 text-red-600 rounded">
          {importError}
        </div>
      )}
    </div>
  );
}