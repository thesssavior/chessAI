import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { parsePgn } from '@/lib/chessUtils';
import { GameState, ChessMove, Game } from '@shared/types';
import { GameSelectionDialog } from './GameSelectionDialog';

interface GameImporterProps {
  onGameLoaded: (gameState: GameState) => void;
}

export function GameImporter({ onGameLoaded }: GameImporterProps) {
  const [chesscomUsername, setChesscomUsername] = useState(() => {
    return localStorage.getItem('chesscomUsername') || '';
  });
  const [lichessUsername, setLichessUsername] = useState(() => {
    return localStorage.getItem('lichessUsername') || '';
  });
  const [lichessGameId, setLichessGameId] = useState('');
  const [importError, setImportError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Game[] | null>(null);
  const [currentArchiveIndex, setCurrentArchiveIndex] = useState(0);
  const [archives, setArchives] = useState<string[]>([]);
  const [hasMoreGames, setHasMoreGames] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Save usernames to localStorage when they change
  useEffect(() => {
    localStorage.setItem('chesscomUsername', chesscomUsername);
  }, [chesscomUsername]);

  useEffect(() => {
    localStorage.setItem('lichessUsername', lichessUsername);
  }, [lichessUsername]);

  const handleImportFromChessCom = async () => {
    if (!chesscomUsername) {
      setImportError('Please enter a username');
      return;
    }

    setIsLoading(true);
    setImportError('');
    setArchives([]);
    setCurrentArchiveIndex(0);
    setSelectedGames(null);
    
    try {
      const response = await apiRequest('GET', `/api/import/chessdotcom?username=${chesscomUsername}`);
      const data = await response.json();
      
      if (response.ok && data.games) {
        setSelectedGames(data.games);
        setArchives(data.archives || []);
        setHasMoreGames(data.archives?.length > 1 || false);
      } else {
        throw new Error(data.message || 'Failed to import games');
      }
    } catch (error) {
      console.error('Error importing from Chess.com:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import games');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreGames || !archives.length) return;

    setIsLoadingMore(true);
    try {
      const nextIndex = currentArchiveIndex + 1;
      if (nextIndex >= archives.length) {
        setHasMoreGames(false);
        return;
      }

      const response = await apiRequest(
        'GET', 
        `/api/import/chessdotcom?username=${chesscomUsername}&archiveUrl=${archives[nextIndex]}`
      );
      const data = await response.json();

      if (response.ok && data.games) {
        setSelectedGames(prev => [...(prev || []), ...data.games]);
        setCurrentArchiveIndex(nextIndex);
        setHasMoreGames(nextIndex < archives.length - 1);
      }
    } catch (error) {
      console.error('Error loading more games:', error);
    } finally {
      setIsLoadingMore(false);
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

  const handleGameSelect = async (game: any) => {
    try {
      const parsedGame = parsePgn(game.pgn);
      if (parsedGame) {
        const { chess, metadata } = parsedGame;
        const gameState: GameState = {
          pgn: game.pgn,
          fen: chess.fen(),
          metadata: {
            ...metadata,
            white: game.white,
            black: game.black,
            result: game.result,
            date: new Date(game.timestamp * 1000).toISOString().split('T')[0]
          },
          history: chess.history({ verbose: true }) as ChessMove[],
          currentMoveIndex: chess.history().length - 1
        };
        onGameLoaded(gameState);
        setSelectedGames(null); // Close dialog
      }
    } catch (error) {
      console.error('Error loading selected game:', error);
      setImportError('Failed to load the selected game');
    }
  };

  const formatPgn = (pgn: string): string => {
    // Extract only the essential metadata and moves
    const lines = pgn.split('\n');
    const essentialHeaders = [
      '[Event "Live Chess"]',
      '[Site "Chess.com"]',
      '[Date "',
      '[White "',
      '[Black "',
      '[Result "',
      '[TimeControl "'
    ];
    
    const filteredLines = lines.filter(line => {
      if (line.startsWith('[')) {
        return essentialHeaders.some(header => line.startsWith(header));
      }
      return true;
    });
    
    return filteredLines.join('\n');
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
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder="Chess.com username"
                value={chesscomUsername}
                onChange={(e) => setChesscomUsername(e.target.value)}
                className="px-4 py-2 border rounded"
              />
              <button
                onClick={handleImportFromChessCom}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
              >
                {isLoading ? 'Loading...' : 'Import Games'}
              </button>
            </div>
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
      
      {selectedGames && (
        <GameSelectionDialog
          games={selectedGames}
          onSelect={handleGameSelect}
          onClose={() => setSelectedGames(null)}
          onLoadMore={handleLoadMore}
          isLoadingMore={isLoadingMore}
          hasMore={hasMoreGames}
        />
      )}
    </div>
  );
}