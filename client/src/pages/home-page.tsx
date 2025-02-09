import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { LogOut, Send } from "lucide-react";
import { useState } from "react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { users, selectedUser, messages, selectUser, sendMessage, isConnected } = useChat();
  const [newMessage, setNewMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage("");
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback>{user?.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{user?.username}</div>
              <div className="text-sm text-muted-foreground">
                {isConnected ? "Online" : "Connecting..."}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {users.map((u) => (
            <div
              key={u.id}
              className={cn(
                "p-4 cursor-pointer hover:bg-accent transition-colors",
                selectedUser?.id === u.id && "bg-accent"
              )}
              onClick={() => selectUser(u)}
            >
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarFallback>{u.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{u.username}</div>
                  <div className="text-sm text-muted-foreground">
                    {u.online ? "Online" : "Offline"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            <div className="p-4 border-b">
              <div className="font-semibold">{selectedUser.username}</div>
              <div className="text-sm text-muted-foreground">
                {selectedUser.online ? "Online" : "Offline"}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[70%] break-words",
                      message.senderId === user?.id
                        ? "ml-auto"
                        : "mr-auto"
                    )}
                  >
                    <Card
                      className={cn(
                        "p-3",
                        message.senderId === user?.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent"
                      )}
                    >
                      {message.content}
                      <div
                        className={cn(
                          "text-xs mt-1",
                          message.senderId === user?.id
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {new Date(message.sent).toLocaleTimeString()}
                        {message.senderId === user?.id && (
                          <span className="ml-2">
                            {message.read ? "Read" : message.delivered ? "Delivered" : "Sent"}
                          </span>
                        )}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
