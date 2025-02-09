import { createContext, ReactNode, useContext, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Message, User, GroupMessage } from "@shared/schema";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";
import { useGroups } from "./use-groups";

type ChatMessage = Message | GroupMessage;

type ChatContextType = {
  users: User[];
  selectedUser: User | null;
  messages: ChatMessage[];
  selectUser: (user: User | null) => void;
  sendMessage: (content: string) => void;
  isConnected: boolean;
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedGroup } = useGroups();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket>();
  const reconnectTimeoutRef = useRef<number>();
  const messageQueueRef = useRef<Array<{ type: string; content: string }>>([]);

  // Query for getting all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  // Query for getting messages with selected user
  const { data: initialMessages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedUser?.id],
    enabled: !!selectedUser,
  });

  // Query for getting group messages
  const { data: groupMessages = [] } = useQuery<GroupMessage[]>({
    queryKey: ["/api/groups", selectedGroup?.id, "messages"],
    enabled: !!selectedGroup,
  });

  // Update messages when initialMessages or groupMessages changes
  useEffect(() => {
    if (selectedUser && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else if (selectedGroup && groupMessages.length > 0) {
      setMessages(groupMessages);
    }
  }, [initialMessages, groupMessages, selectedUser, selectedGroup]);

  const connect = useCallback(() => {
    if (!user) return;

    let ws: WebSocket;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;

    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);

      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      // Send any queued messages
      while (messageQueueRef.current.length > 0) {
        const msg = messageQueueRef.current.shift();
        if (msg) {
          ws.send(JSON.stringify(msg));
        }
      }

      // Join group if selected
      if (selectedGroup) {
        ws.send(JSON.stringify({
          type: "join_group",
          groupAddress: selectedGroup.address
        }));
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      wsRef.current = undefined;

      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server",
        variant: "destructive",
      });
    };

    ws.onmessage = (event) => {
      try {
        console.log('Received message:', event.data);
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "message":
            setMessages(prev => {
              // Avoid duplicate messages
              if (!prev.some(m => m.id === data.message.id)) {
                return [...prev, data.message];
              }
              return prev;
            });
            // Mark as delivered if it's from the current selected user
            if (data.message.senderId === selectedUser?.id && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "delivered",
                messageId: data.message.id,
                senderId: data.message.senderId
              }));
            }
            break;

          case "group_message":
            setMessages(prev => {
              if (!prev.some(m => m.id === data.message.id)) {
                return [...prev, data.message];
              }
              return prev;
            });
            break;

          case "group_messages":
            if (data.messages) {
              setMessages(data.messages);
            }
            break;

          case "group_joined":
            toast({
              title: "Group Joined",
              description: `Successfully joined ${data.group.name}`,
            });
            break;

          case "status":
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            break;

          case "delivered":
            setMessages(prev => prev.map(msg => {
              if ('delivered' in msg && msg.id === data.messageId) {
                return { ...msg, delivered: true };
              }
              return msg;
            }));
            break;

          case "read":
            setMessages(prev => prev.map(msg => {
              if ('read' in msg && msg.senderId === data.readerId) {
                return { ...msg, read: true };
              }
              return msg;
            }));
            break;

          case "error":
            toast({
              title: "Error",
              description: data.message,
              variant: "destructive",
            });
            break;
        }
      } catch (error) {
        console.error("Failed to process message:", error);
      }
    };
  }, [user, queryClient, toast, selectedUser, selectedGroup]);

  // WebSocket connection effect
  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = undefined;
      }
      return;
    }

    let isCleanup = false;

    connect();

    return () => {
      isCleanup = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = undefined;
      }
    };
  }, [user, connect]);

  const selectUser = useCallback((user: User | null) => {
    setSelectedUser(user);
    setMessages([]); // Clear messages when switching users
    if (user) {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", user.id] });
    }
  }, [queryClient]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current || !isConnected) {
      toast({
        title: "Cannot send message",
        description: "Please ensure you're connected to the chat server",
        variant: "destructive",
      });
      return;
    }

    try {
      const message = {
        type: selectedGroup ? "group_message" : "message",
        content,
        ...(selectedGroup ? { groupId: selectedGroup.id } : { receiverId: selectedUser?.id })
      };

      console.log('Sending message:', message);

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        // Queue message if not connected
        messageQueueRef.current.push(message);
        // Attempt to reconnect
        if (wsRef.current.readyState === WebSocket.CLOSED) {
          wsRef.current = undefined;
          connect();
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send",
        description: "Could not send your message. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedUser, selectedGroup, isConnected, toast, connect]);

  const value = useMemo(() => ({
    users,
    selectedUser,
    messages,
    selectUser,
    sendMessage,
    isConnected
  }), [users, selectedUser, messages, selectUser, sendMessage, isConnected]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}