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

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const { data: initialMessages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedUser?.id],
    enabled: !!selectedUser,
  });

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

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

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onclose = () => {
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
          const data = JSON.parse(event.data);
          if (data.type === "message") {
            setMessages(prev => [...prev, data.message]);
          } else if (data.type === "status") {
            // Invalidate users query to refresh the list when someone's status changes
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          }
        } catch (error) {
          console.error("Failed to process message:", error);
        }
      };

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = undefined;
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setIsConnected(false);
    }
  }, [user, toast, queryClient]);

  const selectUser = useCallback((user: User) => {
    setSelectedUser(user);
  }, []);

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

  const contextValue = useMemo(() => ({
    users,
    selectedUser,
    messages,
    selectUser,
    sendMessage,
    isConnected
  }), [users, selectedUser, messages, selectUser, sendMessage, isConnected]);

  return (
    <ChatContext.Provider value={contextValue}>
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