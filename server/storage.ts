import { InsertUser, User, InsertMessage, Message, Group, GroupMember, GroupMessage, InsertGroup } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  setUserOnline(id: number, online: boolean): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Direct message methods
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(user1Id: number, user2Id: number): Promise<Message[]>;
  markMessagesAsDelivered(receiverId: number): Promise<void>;
  markMessagesAsRead(senderId: number, receiverId: number): Promise<void>;

  // Group methods
  createGroup(group: InsertGroup & { adminId: number }): Promise<Group>;
  getGroupByAddress(address: string): Promise<Group | undefined>;
  getGroupById(id: number): Promise<Group | undefined>;
  addGroupMember(groupId: number, userId: number): Promise<void>;
  removeGroupMember(groupId: number, userId: number): Promise<void>;
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
  getUserGroups(userId: number): Promise<Group[]>;
  createGroupMessage(message: GroupMessage): Promise<GroupMessage>;
  getGroupMessages(groupId: number): Promise<GroupMessage[]>;
  isGroupAdmin(groupId: number, userId: number): Promise<boolean>;

  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  private groups: Map<number, Group>;
  private groupMembers: Map<number, GroupMember>;
  private groupMessages: Map<number, GroupMessage>;
  private currentUserId: number;
  private currentMessageId: number;
  private currentGroupId: number;
  private currentGroupMemberId: number;
  private currentGroupMessageId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.groups = new Map();
    this.groupMembers = new Map();
    this.groupMessages = new Map();
    this.currentUserId = 1;
    this.currentMessageId = 1;
    this.currentGroupId = 1;
    this.currentGroupMemberId = 1;
    this.currentGroupMessageId = 1;
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
      user.online = online;
      this.users.set(id, user);
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
    return Array.from(this.messages.values())
      .filter(msg => 
        (msg.senderId === user1Id && msg.receiverId === user2Id) ||
        (msg.senderId === user2Id && msg.receiverId === user1Id)
      )
      .sort((a, b) => a.sent.getTime() - b.sent.getTime());
  }

  async markMessagesAsDelivered(receiverId: number): Promise<void> {
    Array.from(this.messages.entries()).forEach(([id, message]) => {
      if (message.receiverId === receiverId && !message.delivered) {
        message.delivered = true;
        this.messages.set(id, message);
      }
    });
  }

  async markMessagesAsRead(senderId: number, receiverId: number): Promise<void> {
    Array.from(this.messages.entries()).forEach(([id, message]) => {
      if (message.senderId === senderId && message.receiverId === receiverId && !message.read) {
        message.read = true;
        this.messages.set(id, message);
      }
    });
  }

  async createGroup(group: InsertGroup & { adminId: number }): Promise<Group> {
    const id = this.currentGroupId++;
    const newGroup: Group = {
      ...group,
      id,
      createdAt: new Date(),
    };
    this.groups.set(id, newGroup);

    // Add admin as first member
    await this.addGroupMember(id, group.adminId);

    return newGroup;
  }

  async getGroupByAddress(address: string): Promise<Group | undefined> {
    return Array.from(this.groups.values()).find(
      (group) => group.address === address,
    );
  }

  async getGroupById(id: number): Promise<Group | undefined> {
    return this.groups.get(id);
  }

  async addGroupMember(groupId: number, userId: number): Promise<void> {
    const id = this.currentGroupMemberId++;
    const member: GroupMember = {
      id,
      groupId,
      userId,
      joinedAt: new Date(),
    };
    this.groupMembers.set(id, member);
  }

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    const memberEntry = Array.from(this.groupMembers.entries()).find(
      ([, member]) => member.groupId === groupId && member.userId === userId
    );
    if (memberEntry) {
      this.groupMembers.delete(memberEntry[0]);
    }
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return Array.from(this.groupMembers.values())
      .filter(member => member.groupId === groupId);
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const memberGroups = Array.from(this.groupMembers.values())
      .filter(member => member.userId === userId)
      .map(member => member.groupId);

    return Array.from(this.groups.values())
      .filter(group => memberGroups.includes(group.id));
  }

  async createGroupMessage(message: GroupMessage): Promise<GroupMessage> {
    const id = this.currentGroupMessageId++;
    const newMessage: GroupMessage = {
      ...message,
      id,
      sent: new Date(),
    };
    this.groupMessages.set(id, newMessage);
    return newMessage;
  }

  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    return Array.from(this.groupMessages.values())
      .filter(msg => msg.groupId === groupId)
      .sort((a, b) => a.sent.getTime() - b.sent.getTime());
  }

  async isGroupAdmin(groupId: number, userId: number): Promise<boolean> {
    const group = await this.getGroupById(groupId);
    return group?.adminId === userId;
  }
}

export const storage = new MemStorage();