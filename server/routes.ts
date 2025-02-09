import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema, insertGroupSchema } from "@shared/schema";

type WSMessage = {
  type: "message" | "typing" | "read" | "delivered" | "group_message" | "join_group";
  content?: string;
  receiverId?: number;
  messageId?: number;
  senderId?: number;
  groupId?: number;
  groupAddress?: string;
};

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<number, WebSocket>();
  const groupSubscriptions = new Map<number, Set<number>>(); // groupId -> Set of userIds

  wss.on("connection", (ws, req) => {
    if (!req.url) return ws.close();

    const userId = parseInt(new URL(req.url, "http://localhost").searchParams.get("userId") || "");
    if (isNaN(userId)) return ws.close();

    console.log(`User ${userId} connected`);
    clients.set(userId, ws);
    storage.setUserOnline(userId, true);
    broadcastUserStatus(userId, true);

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WSMessage;
        console.log('Received WebSocket message:', msg);

        switch (msg.type) {
          case "message":
            if (msg.receiverId && msg.content) {
              const message = await storage.createMessage({
                senderId: userId,
                receiverId: msg.receiverId,
                content: msg.content,
              });

              // Send to receiver if online
              const receiverWs = clients.get(msg.receiverId);
              if (receiverWs?.readyState === WebSocket.OPEN) {
                console.log('Sending message to receiver:', msg.receiverId);
                receiverWs.send(JSON.stringify({ type: "message", message }));
              }

              // Send back to sender with the created message
              console.log('Sending message back to sender:', userId);
              ws.send(JSON.stringify({ type: "message", message }));
            }
            break;

          case "group_message":
            if (msg.groupId && msg.content) {
              const members = await storage.getGroupMembers(msg.groupId);
              if (!members.some(m => m.userId === userId)) {
                console.log('User not in group:', userId);
                return;
              }

              const message = await storage.createGroupMessage({
                groupId: msg.groupId,
                senderId: userId,
                content: msg.content,
                id: 0, // Will be set by storage
                sent: new Date(),
              });

              // Broadcast to all group members
              const groupMembers = groupSubscriptions.get(msg.groupId) || new Set();
              groupMembers.forEach(memberId => {
                const memberWs = clients.get(memberId);
                if (memberWs?.readyState === WebSocket.OPEN) {
                  memberWs.send(JSON.stringify({ 
                    type: "group_message", 
                    message,
                  }));
                }
              });
            }
            break;

          case "join_group":
            if (msg.groupAddress) {
              const group = await storage.getGroupByAddress(msg.groupAddress);
              if (!group) {
                ws.send(JSON.stringify({ 
                  type: "error", 
                  message: "Group not found" 
                }));
                return;
              }

              const members = await storage.getGroupMembers(group.id);
              if (members.length >= 10) {
                ws.send(JSON.stringify({ 
                  type: "error", 
                  message: "Group is full" 
                }));
                return;
              }

              if (!members.some(m => m.userId === userId)) {
                await storage.addGroupMember(group.id, userId);
              }

              // Subscribe to group messages
              let groupSubs = groupSubscriptions.get(group.id);
              if (!groupSubs) {
                groupSubs = new Set();
                groupSubscriptions.set(group.id, groupSubs);
              }
              groupSubs.add(userId);

              // Send success response with group details
              ws.send(JSON.stringify({ 
                type: "group_joined", 
                group 
              }));

              // Send recent messages
              const messages = await storage.getGroupMessages(group.id);
              ws.send(JSON.stringify({ 
                type: "group_messages", 
                groupId: group.id,
                messages 
              }));
            }
            break;

          case "delivered":
            if (msg.messageId && msg.senderId) {
              await storage.markMessagesAsDelivered(userId);
              const senderWs = clients.get(msg.senderId);
              if (senderWs?.readyState === WebSocket.OPEN) {
                senderWs.send(JSON.stringify({
                  type: "delivered",
                  messageId: msg.messageId
                }));
              }
            }
            break;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      console.log(`User ${userId} disconnected`);
      clients.delete(userId);
      storage.setUserOnline(userId, false);
      broadcastUserStatus(userId, false);

      // Remove user from all group subscriptions
      for (const [groupId, members] of groupSubscriptions.entries()) {
        members.delete(userId);
        if (members.size === 0) {
          groupSubscriptions.delete(groupId);
        }
      }
    });
  });

  function broadcastUserStatus(userId: number, online: boolean) {
    const message = JSON.stringify({
      type: "status",
      userId,
      online,
    });

    Array.from(clients.entries()).forEach(([, client]) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // HTTP endpoints for groups
  app.post("/api/groups", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const groupData = insertGroupSchema.parse(req.body);
      const existingGroup = await storage.getGroupByAddress(groupData.address);

      if (existingGroup) {
        return res.status(400).json({ message: "Address already taken" });
      }

      const group = await storage.createGroup({
        ...groupData,
        adminId: req.user!.id,
      });

      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ message: "Invalid group data" });
    }
  });

  app.get("/api/groups/me", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const groups = await storage.getUserGroups(req.user!.id);
    res.json(groups);
  });

  app.get("/api/groups/:address", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const group = await storage.getGroupByAddress(req.params.address);
    if (!group) return res.status(404).json({ message: "Group not found" });
    res.json(group);
  });

  app.get("/api/groups/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const groupId = parseInt(req.params.id);
    if (isNaN(groupId)) return res.sendStatus(400);

    const members = await storage.getGroupMembers(groupId);
    if (!members.some(m => m.userId === req.user!.id)) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const messages = await storage.getGroupMessages(groupId);
    res.json(messages);
  });

  // Existing user and message endpoints
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getAllUsers();
    res.json(users.filter(u => u.id !== req.user!.id));
  });

  app.get("/api/messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const otherUserId = parseInt(req.params.userId);
    if (isNaN(otherUserId)) return res.sendStatus(400);

    const messages = await storage.getMessages(req.user!.id, otherUserId);
    await storage.markMessagesAsRead(otherUserId, req.user!.id);

    const otherWs = clients.get(otherUserId);
    if (otherWs?.readyState === WebSocket.OPEN) {
      otherWs.send(JSON.stringify({ 
        type: "read",
        readerId: req.user!.id
      }));
    }

    res.json(messages);
  });

  return httpServer;
}