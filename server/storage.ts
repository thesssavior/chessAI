import { 
  games, type Game, type InsertGame, 
  chats, type Chat, type InsertChat 
} from "@shared/schema";
import { ChatMessage } from "@shared/types";

export interface IStorage {
  // Game operations
  getGame(id: number): Promise<Game | undefined>;
  saveGame(game: InsertGame): Promise<Game>;
  
  // Chat operations
  getChatByGameId(gameId: string): Promise<Chat | undefined>;
  saveChat(chat: InsertChat): Promise<Chat>;
  updateChatMessages(id: number, messages: ChatMessage[]): Promise<Chat | undefined>;
}

export class MemStorage implements IStorage {
  private games: Map<number, Game>;
  private chats: Map<number, Chat>;
  private gameIdCounter: number;
  private chatIdCounter: number;

  constructor() {
    this.games = new Map();
    this.chats = new Map();
    this.gameIdCounter = 1;
    this.chatIdCounter = 1;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async saveGame(insertGame: InsertGame): Promise<Game> {
    const id = this.gameIdCounter++;
    const game: Game = { 
      ...insertGame, 
      id, 
      createdAt: new Date() 
    };
    this.games.set(id, game);
    return game;
  }

  async getChatByGameId(gameId: string): Promise<Chat | undefined> {
    return Array.from(this.chats.values())
      .find(chat => chat.gameId === gameId);
  }

  async saveChat(insertChat: InsertChat): Promise<Chat> {
    const id = this.chatIdCounter++;
    const chat: Chat = { 
      ...insertChat, 
      id, 
      createdAt: new Date() 
    };
    this.chats.set(id, chat);
    return chat;
  }

  async updateChatMessages(id: number, messages: ChatMessage[]): Promise<Chat | undefined> {
    const chat = this.chats.get(id);
    if (!chat) return undefined;
    
    const updatedChat: Chat = {
      ...chat,
      messages: messages
    };
    
    this.chats.set(id, updatedChat);
    return updatedChat;
  }
}

export const storage = new MemStorage();
