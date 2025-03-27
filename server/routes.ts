import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzePosition } from "./openai";
import { z } from "zod";
import { insertChatSchema, insertGameSchema } from "@shared/schema";
import { ChatMessage } from "@shared/types";

export async function registerRoutes(app: Express): Promise<Server> {
  // API route for importing a game from Chess.com
  app.get("/api/import/chessdotcom", async (req, res) => {
    try {
      const { username, gameUrl } = req.query;
      
      if (gameUrl) {
        // Extract game ID from URL - now support multiple URL formats
        let gameId = '';
        const urlString = String(gameUrl);
        
        // Handle different chess.com URL formats
        if (urlString.includes('/live/game/')) {
          const liveMatch = urlString.match(/\/live\/game\/(\d+)/);
          if (liveMatch) gameId = liveMatch[1];
        } else if (urlString.includes('/game/live/')) {
          const liveMatch = urlString.match(/\/game\/live\/(\d+)/);
          if (liveMatch) gameId = liveMatch[1];
        } else if (urlString.includes('/daily/game/')) {
          const dailyMatch = urlString.match(/\/daily\/game\/(\d+)/);
          if (dailyMatch) gameId = dailyMatch[1];
        } else if (urlString.includes('/game/daily/')) {
          const dailyMatch = urlString.match(/\/game\/daily\/(\d+)/);
          if (dailyMatch) gameId = dailyMatch[1];
        } else {
          // Fallback to the simple pattern
          const simpleMatch = urlString.match(/\/(\d+)$/);
          if (simpleMatch) gameId = simpleMatch[1];
        }
        
        if (!gameId) {
          return res.status(400).json({ message: "Invalid Chess.com game URL. Please use a URL from a game page on chess.com" });
        }
        
        console.log(`Attempting to fetch Chess.com game with ID: ${gameId}`);
        
        // Try multiple Chess.com API endpoints
        const endpoints = [
          `https://www.chess.com/callback/game/live/export/pgn/${gameId}`,
          `https://www.chess.com/callback/game/daily/export/pgn/${gameId}`,
          `https://www.chess.com/callback/games/archive/live/download/${gameId}`,
          `https://www.chess.com/callback/games/archive/daily/download/${gameId}`
        ];
        
        let response = null;
        let successEndpoint = '';
        
        // Try each endpoint until we find one that works
        for (const endpoint of endpoints) {
          console.log(`Trying endpoint: ${endpoint}`);
          const tempResponse = await fetch(endpoint);
          if (tempResponse.ok) {
            response = tempResponse;
            successEndpoint = endpoint;
            console.log(`Found working endpoint: ${endpoint}`);
            break;
          }
        }
        
        if (!response || !response.ok) {
          console.log('All Chess.com endpoints failed');
          return res.status(404).json({ message: "Game not found on Chess.com. Check your URL and try again." });
        }
        
        console.log(`Successfully fetched game from: ${successEndpoint}`);
        
        const pgn = await response.text();
        res.json({ pgn });
      } else if (username) {
        // Fetch recent games for a user
        const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
        
        if (!response.ok) {
          return res.status(404).json({ message: "User not found on Chess.com" });
        }
        
        const archives = await response.json();
        
        if (!archives.archives || archives.archives.length === 0) {
          return res.status(404).json({ message: "No games found for user" });
        }
        
        // Get the most recent month of games
        const latestArchiveUrl = archives.archives[archives.archives.length - 1];
        const gamesResponse = await fetch(latestArchiveUrl);
        
        if (!gamesResponse.ok) {
          return res.status(500).json({ message: "Failed to fetch games from Chess.com" });
        }
        
        const games = await gamesResponse.json();
        
        if (!games.games || games.games.length === 0) {
          return res.status(404).json({ message: "No games found for user in the latest month" });
        }
        
        // Find the latest game with a valid PGN
        let pgn = null;
        
        // Go through the games in reverse to find the most recent game with a valid PGN
        for (let i = games.games.length - 1; i >= 0; i--) {
          const game = games.games[i];
          if (game.pgn && game.pgn.trim().length > 0) {
            pgn = game.pgn;
            break;
          }
        }
        
        if (!pgn) {
          return res.status(404).json({ message: "No valid PGN found in user's recent games" });
        }
        
        res.json({ pgn });
      } else {
        res.status(400).json({ message: "Missing username or game URL" });
      }
    } catch (error) {
      console.error("Chess.com import error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to import from Chess.com" 
      });
    }
  });
  
  // API route for importing a game from Lichess
  app.get("/api/import/lichess", async (req, res) => {
    try {
      const { username, gameId } = req.query;
      
      if (gameId) {
        // Fetch a specific game by ID
        const response = await fetch(`https://lichess.org/game/export/${gameId}?pgnInJson=true`);
        
        if (!response.ok) {
          return res.status(404).json({ message: "Game not found on Lichess" });
        }
        
        const data = await response.json();
        res.json({ pgn: data.pgn });
      } else if (username) {
        // Fetch recent games for a user
        const response = await fetch(`https://lichess.org/api/games/user/${username}?max=1&pgnInJson=true`);
        
        if (!response.ok) {
          return res.status(404).json({ message: "User not found on Lichess" });
        }
        
        const games = await response.json();
        
        if (!games || games.length === 0) {
          return res.status(404).json({ message: "No games found for user" });
        }
        
        // Return the most recent game's PGN
        const latestGame = games[0];
        res.json({ pgn: latestGame.pgn });
      } else {
        res.status(400).json({ message: "Missing username or game ID" });
      }
    } catch (error) {
      console.error("Lichess import error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to import from Lichess" 
      });
    }
  });
  // API route for analyzing a chess position
  app.post("/api/analyze", async (req, res) => {
    try {
      const schema = z.object({
        fen: z.string(),
        pgn: z.string(),
        currentMoveNumber: z.number(),
        question: z.string().optional()
      });

      const validatedData = schema.parse(req.body);
      const analysis = await analyzePosition(validatedData);
      
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid request" 
      });
    }
  });

  // API route for analyzing a position with engine evaluation
  app.post("/api/analyze-with-engine", async (req, res) => {
    try {
      const schema = z.object({
        fen: z.string(),
        pgn: z.string(),
        currentMoveNumber: z.number(),
        engineEvaluation: z.object({
          score: z.string(),
          bestMove: z.string(),
          bestLine: z.string().optional(),
          depth: z.number()
        })
      });

      const validatedData = schema.parse(req.body);
      const analysis = await analyzePosition(validatedData);
      
      res.json(analysis);
    } catch (error) {
      console.error("Engine analysis error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid request" 
      });
    }
  });

  // API route for saving a game
  app.post("/api/games", async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse(req.body);
      const game = await storage.saveGame(validatedData);
      res.status(201).json(game);
    } catch (error) {
      console.error("Game save error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid game data" 
      });
    }
  });

  // API route for getting a game
  app.get("/api/games/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid game ID" });
      }
      
      const game = await storage.getGame(id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      
      res.json(game);
    } catch (error) {
      console.error("Game retrieval error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
      });
    }
  });

  // API route for saving/updating chat messages
  app.post("/api/chats", async (req, res) => {
    try {
      const validatedData = insertChatSchema.parse(req.body);
      const existingChat = await storage.getChatByGameId(validatedData.gameId);
      
      if (existingChat) {
        // Update existing chat
        const messages = validatedData.messages as ChatMessage[];
        const updatedChat = await storage.updateChatMessages(existingChat.id, messages);
        return res.json(updatedChat);
      } else {
        // Create new chat
        const chat = await storage.saveChat(validatedData);
        return res.status(201).json(chat);
      }
    } catch (error) {
      console.error("Chat save error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid chat data" 
      });
    }
  });

  // API route for getting chat history by game ID
  app.get("/api/chats/game/:gameId", async (req, res) => {
    try {
      const { gameId } = req.params;
      const chat = await storage.getChatByGameId(gameId);
      
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      res.json(chat);
    } catch (error) {
      console.error("Chat retrieval error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Server error" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
