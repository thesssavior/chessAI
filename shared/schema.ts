import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Storing chat history for users
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull(), // Unique identifier for the game
  messages: jsonb("messages").notNull(), // Array of chat messages
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Games in PGN format
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  pgn: text("pgn").notNull(), // Full PGN text
  metadata: jsonb("metadata").notNull(), // Extracted metadata (event, players, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas for inserting data
export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chats.$inferSelect;

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;
