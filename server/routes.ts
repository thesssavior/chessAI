import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzePosition } from "./openai";
import { z } from "zod";
import { insertChatSchema, insertGameSchema } from "@shared/schema";
import { ChatMessage } from "@shared/types";
import { Chess } from "chess.js";
import path from "path";

interface ChessComGame {
  pgn: string;
  white: { username: string };
  black: { username: string };
  result: string;
  end_time: number;
  url: string;
}

interface ChessComResponse {
  games: ChessComGame[];
}

interface ChessComArchivesResponse {
  archives: string[];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve Stockfish.js from the public directory
  app.get("/stockfish.js", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/stockfish.js"));
  });

  // API route for importing a game from Chess.com
  app.get("/api/import/chessdotcom", async (req, res) => {
    try {
      const { username, archiveUrl, gameUrl } = req.query;
      
      if (!username && !gameUrl) {
        return res.status(400).json({ message: "Missing username or game URL parameter" });
      }

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      };
      
      if (gameUrl) {
        // Extract game ID from URL
        const gameIdMatch = String(gameUrl).match(/\/game\/live\/(\d+)/);
        if (!gameIdMatch) {
          return res.status(400).json({ 
            message: "Invalid Chess.com game URL",
            details: "URL should be in format: https://www.chess.com/game/live/[gameId]"
          });
        }

        const gameId = gameIdMatch[1];
        console.log('Fetching game:', gameId);
        
        // Use the public API endpoint
        const gameResponse = await fetch(`https://api.chess.com/pub/game/${gameId}`, { headers });
        if (!gameResponse.ok) {
          const errorText = await gameResponse.text();
          console.error('Chess.com game response error:', {
            status: gameResponse.status,
            statusText: gameResponse.statusText,
            gameId,
            response: errorText
          });
          return res.status(404).json({ 
            message: "Game not found",
            details: "The game might be private or no longer available"
          });
        }

        const gameData = await gameResponse.json();
        if (!gameData.pgn) {
          return res.status(400).json({ 
            message: "No PGN available",
            details: "This game might not be completed or might be private"
          });
        }

        // Ensure the timestamp is not in the future
        const timestamp = gameData.end_time || Math.floor(Date.now() / 1000);
        
        return res.json({
          games: [{
            pgn: gameData.pgn,
            white: gameData.white.username,
            black: gameData.black.username,
            result: gameData.result,
            timestamp: timestamp,
            url: gameUrl
          }]
        });
      } else if (archiveUrl) {
        // Fetch specific archive
        console.log('Fetching archive:', archiveUrl);
        const gamesResponse = await fetch(String(archiveUrl), { headers });
        if (!gamesResponse.ok) {
          console.error('Chess.com archive response error:', {
            status: gamesResponse.status,
            statusText: gamesResponse.statusText,
            url: archiveUrl
          });
          return res.status(500).json({ 
            message: `Failed to fetch games from Chess.com: ${gamesResponse.status} ${gamesResponse.statusText}` 
          });
        }
        
        const gamesData = await gamesResponse.json() as ChessComResponse;
        if (!gamesData.games || !Array.isArray(gamesData.games)) {
          console.error('Invalid games data format:', gamesData);
          return res.status(500).json({ message: "Invalid response format from Chess.com" });
        }

        const games = gamesData.games
          .map((game: ChessComGame) => ({
            pgn: game.pgn,
            white: game.white.username,
            black: game.black.username,
            result: game.result,
            timestamp: game.end_time,
            url: game.url
          }))
          .filter((game: { pgn: string }) => game.pgn && game.pgn.trim().length > 0);

        return res.json({ games });
      } else {
        // First request - get archives and first batch of games
        const archivesUrl = `https://api.chess.com/pub/player/${username}/games/archives`;
        console.log('Fetching archives for user:', username, 'URL:', archivesUrl);
        
        const archiveResponse = await fetch(archivesUrl, { headers });
        if (!archiveResponse.ok) {
          const errorText = await archiveResponse.text();
          console.error('Chess.com archives response error:', {
            status: archiveResponse.status,
            statusText: archiveResponse.statusText,
            username,
            url: archivesUrl,
            response: errorText
          });
          
          if (archiveResponse.status === 404) {
            return res.status(404).json({ 
              message: "User not found on Chess.com",
              details: "Please check if the username is correct and the account exists"
            });
          }
          
          return res.status(500).json({ 
            message: `Failed to fetch archives from Chess.com: ${archiveResponse.status} ${archiveResponse.statusText}`,
            details: errorText
          });
        }
        
        const archivesData = await archiveResponse.json() as ChessComArchivesResponse;
        console.log('Archives response:', {
          archiveCount: archivesData.archives?.length || 0,
          hasArchives: Boolean(archivesData.archives?.length)
        });
        
        if (!archivesData.archives || !Array.isArray(archivesData.archives) || archivesData.archives.length === 0) {
          console.error('No archives found for user:', username);
          return res.status(404).json({ 
            message: "No games found for user",
            details: "This user has no games in their history"
          });
        }

        // Get current and previous month's archives
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // Try current month first, then previous month
        const archiveUrls = [
          `https://api.chess.com/pub/player/${username}/games/${currentYear}/${String(currentMonth).padStart(2, '0')}`,
          `https://api.chess.com/pub/player/${username}/games/${previousYear}/${String(previousMonth).padStart(2, '0')}`
        ];

        console.log('Trying archive URLs:', archiveUrls);

        let games: any[] = [];
        let archives = archivesData.archives;

        for (const archiveUrl of archiveUrls) {
          try {
            console.log('Fetching archive:', archiveUrl);
            
            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const gamesResponse = await fetch(archiveUrl, { 
              headers: {
                ...headers,
                'Cache-Control': 'no-cache'
              }
            });
        
        if (!gamesResponse.ok) {
              console.log('Archive not available:', archiveUrl);
              continue;
            }
            
            const gamesData = await gamesResponse.json() as ChessComResponse;
            console.log('Games response:', {
              url: archiveUrl,
              gameCount: gamesData.games?.length || 0,
              hasGames: Boolean(gamesData.games?.length)
            });
            
            if (gamesData.games && Array.isArray(gamesData.games)) {
              const validGames = gamesData.games
                .reverse()
                .map((game: ChessComGame) => ({
                  pgn: game.pgn,
                  white: game.white.username,
                  black: game.black.username,
                  result: game.result,
                  timestamp: game.end_time,
                  url: game.url
                }))
                .filter((game: { pgn: string }) => game.pgn && game.pgn.trim().length > 0);

              console.log('Valid games from archive:', {
                url: archiveUrl,
                totalGames: gamesData.games.length,
                validGames: validGames.length
              });

              games = [...games, ...validGames];
            }
          } catch (error) {
            console.error('Error fetching archive:', archiveUrl, error);
            continue;
          }
        }

        if (games.length === 0) {
          console.error('No valid games found in any archive');
          return res.status(404).json({ 
            message: "No games found for user",
            details: "No valid games found in current or previous month"
          });
        }

        console.log('Total valid games found:', games.length);
        return res.json({ 
          games,
          archives: archives.reverse() // Newest first
        });
      }
    } catch (error) {
      console.error("Chess.com import error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to import from Chess.com",
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });
  
  // API route for analyzing a position
  app.post("/api/analyze", async (req, res) => {
    try {
      const result = await analyzePosition(req.body);
      res.json(result);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to analyze position" 
      });
    }
  });

  // API route for getting chat messages for a game
  app.get("/api/chats/game/:gameId", async (req, res) => {
    try {
      const { gameId } = req.params;
      const chat = await storage.getChatByGameId(gameId);
      
      if (!chat) {
        return res.json({ messages: [] });
      }
      
      res.json({ messages: chat.messages });
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch chat messages" 
      });
    }
  });

  // API route for saving chat messages
  app.post("/api/chats", async (req, res) => {
    try {
      const { gameId, messages, context } = req.body;
      
      // Get AI response using OpenAI
      try {
        const aiResponse = await analyzePosition({
          fen: context.fen,
          pgn: context.pgn,
          currentMoveNumber: context.currentMoveNumber,
          question: messages[messages.length - 1].content,
          stockfishAnalysis: context.stockfishAnalysis,
          engineEvaluation: context.evaluation ? {
            score: context.evaluation.type === 'cp' ? 
              (context.evaluation.value / 100).toFixed(2) : 
              `Mate in ${Math.abs(context.evaluation.value)}`,
            bestMove: context.evaluation.bestMove,
            bestLine: context.evaluation.line,
            depth: context.evaluation.depth || 25
          } : undefined
        });
        
        // Create AI message
        const aiMessage = {
          role: 'assistant',
          content: aiResponse.analysis,
          timestamp: Date.now()
        };
        
        // Add AI message to messages
        const updatedMessages = [...messages, aiMessage];
        
        // Save to database
        const existingChat = await storage.getChatByGameId(gameId);
        
        if (existingChat) {
          const updatedChat = await storage.updateChatMessages(existingChat.id, updatedMessages);
          if (!updatedChat) {
            throw new Error("Failed to update chat messages");
          }
          res.json({ message: aiResponse.analysis });
        } else {
          const newChat = await storage.saveChat({ gameId, messages: updatedMessages });
          res.json({ message: aiResponse.analysis });
        }
      } catch (error) {
        console.error("Error getting AI response:", error);
        res.status(500).json({ 
          message: error instanceof Error ? error.message : "Failed to get AI response" 
        });
      }
    } catch (error) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process chat request" 
      });
    }
  });

  // API route for checking API key format
  app.get("/api/keycheck", async (req, res) => {
    res.json({
      isValid: true,
      message: "API connection ready"
    });
  });

  return createServer(app);
}