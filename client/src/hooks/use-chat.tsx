import { createContext, ReactNode, useContext, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Message, User } from "@shared/schema";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

type ChatContextType = {
  users: User[];
  selectedUser: User | null;
  messages: Message[];
  selectUser: (user: User) => void;
  sendMessage: (content: string) => void;
  isConnected: boolean;
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket>();

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

  // Update messages when initialMessages changes
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}`;
    let ws: WebSocket;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);
          wsRef.current = undefined;
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
                setMessages(prev => [...prev, data.message]);
                // Mark as delivered if it's from the current selected user
                if (data.message.senderId === selectedUser?.id && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: "delivered",
                    messageId: data.message.id,
                    senderId: data.message.senderId
                  }));
                }
                break;

              case "status":
                queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                break;

              case "delivered":
                setMessages(prev => prev.map(msg => 
                  msg.id === data.messageId ? { ...msg, delivered: true } : msg
                ));
                break;

              case "read":
                setMessages(prev => prev.map(msg => 
                  msg.senderId === data.readerId ? { ...msg, read: true } : msg
                ));
                break;
            }
          } catch (error) {
            console.error("Failed to process message:", error);
          }
        };
      } catch (error) {
        console.error("WebSocket connection error:", error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = undefined;
      }
    };
  }, [user, queryClient, toast]); // Removed selectedUser from dependencies

  const selectUser = useCallback((user: User) => {
    setSelectedUser(user);
    queryClient.invalidateQueries({ queryKey: ["/api/messages", user.id] });
  }, [queryClient]);

  const sendMessage = useCallback((content: string) => {
    if (!selectedUser || !wsRef.current || !isConnected) {
      toast({
        title: "Cannot send message",
        description: "Please ensure you're connected and have selected a recipient",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Sending message:', { content, receiverId: selectedUser.id });
      wsRef.current.send(JSON.stringify({
        type: "message",
        content,
        receiverId: selectedUser.id
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send",
        description: "Could not send your message. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedUser, isConnected, toast]);

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