import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";

type WSMessage = {
  type: "message" | "typing" | "read" | "delivered";
  content?: string;
  receiverId?: number;
};

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const clients = new Map<number, WebSocket>();

  wss.on("connection", (ws, req) => {
    if (!req.url) return ws.close();

    const userId = parseInt(new URL(req.url, "http://localhost").searchParams.get("userId") || "");
    if (isNaN(userId)) return ws.close();

    clients.set(userId, ws);
    storage.setUserOnline(userId, true);
    broadcastUserStatus(userId, true);

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WSMessage;

        if (msg.type === "message" && msg.receiverId && msg.content) {
          const message = await storage.createMessage({
            senderId: userId,
            receiverId: msg.receiverId,
            content: msg.content,
          });

          const receiverWs = clients.get(msg.receiverId);
          if (receiverWs?.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({ type: "message", message }));
          }
          ws.send(JSON.stringify({ type: "message", message }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      clients.delete(userId);
      storage.setUserOnline(userId, false);
      broadcastUserStatus(userId, false);
    });
  });

  function broadcastUserStatus(userId: number, online: boolean) {
    const message = JSON.stringify({
      type: "status",
      userId,
      online,
    });

    // Use Array.from to avoid TypeScript iteration error
    Array.from(clients.entries()).forEach(([, client]) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

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