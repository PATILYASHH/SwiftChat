import { InsertUser, User, InsertMessage, Message } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  setUserOnline(id: number, online: boolean): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(user1Id: number, user2Id: number): Promise<Message[]>;
  markMessagesAsDelivered(receiverId: number): Promise<void>;
  markMessagesAsRead(senderId: number, receiverId: number): Promise<void>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentMessageId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentMessageId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id, online: false };
    this.users.set(id, user);
    return user;
  }

  async setUserOnline(id: number, online: boolean): Promise<void> {
    const user = await this.getUser(id);
    if (user) {
      this.users.set(id, { ...user, online });
    }
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = {
      ...insertMessage,
      id,
      sent: new Date(),
      delivered: false,
      read: false,
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessages(user1Id: number, user2Id: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (msg) =>
        (msg.senderId === user1Id && msg.receiverId === user2Id) ||
        (msg.senderId === user2Id && msg.receiverId === user1Id),
    ).sort((a, b) => a.sent.getTime() - b.sent.getTime());
  }

  async markMessagesAsDelivered(receiverId: number): Promise<void> {
    for (const [id, message] of this.messages) {
      if (message.receiverId === receiverId && !message.delivered) {
        this.messages.set(id, { ...message, delivered: true });
      }
    }
  }

  async markMessagesAsRead(senderId: number, receiverId: number): Promise<void> {
    for (const [id, message] of this.messages) {
      if (message.senderId === senderId && message.receiverId === receiverId && !message.read) {
        this.messages.set(id, { ...message, read: true });
      }
    }
  }
}

export const storage = new MemStorage();
