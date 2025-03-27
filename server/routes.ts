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
        // Extract game ID from URL
        const gameIdMatch = String(gameUrl).match(/\/(\d+)$/);
        if (!gameIdMatch) {
          return res.status(400).json({ message: "Invalid Chess.com game URL" });
        }
        
        const gameId = gameIdMatch[1];
        const response = await fetch(`https://www.chess.com/callback/game/live/export/pgn/${gameId}`);
        
        if (!response.ok) {
          return res.status(404).json({ message: "Game not found on Chess.com" });
        }
        
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
        
        // Return the most recent game's PGN
        const latestGame = games.games[games.games.length - 1];
        const pgn = latestGame.pgn;
        
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
