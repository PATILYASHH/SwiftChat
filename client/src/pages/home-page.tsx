import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useChat } from "@/hooks/use-chat";
import { useGroups } from "@/hooks/use-groups";
import { cn } from "@/lib/utils";
import { LogOut, Send, Plus, Hash } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGroupSchema, type InsertGroup } from "@shared/schema";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { users, selectedUser, messages, selectUser, sendMessage, isConnected } = useChat();
  const { groups, selectedGroup, selectGroup, createGroup, joinGroup } = useGroups();
  const [newMessage, setNewMessage] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupAddress, setGroupAddress] = useState("");

  const createGroupForm = useForm<InsertGroup>({
    resolver: zodResolver(insertGroupSchema),
    defaultValues: {
      name: "",
      address: "",
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    sendMessage(newMessage);
    setNewMessage("");
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

        <Tabs defaultValue="direct" className="flex-1 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="direct" className="flex-1">Direct Messages</TabsTrigger>
            <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="flex-1">
            <ScrollArea className="flex-1">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-accent transition-colors",
                    selectedUser?.id === u.id && "bg-accent"
                  )}
                  onClick={() => {
                    selectUser(u);
                    selectGroup(null);
                  }}
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
          </TabsContent>

          <TabsContent value="groups" className="flex-1 flex flex-col">
            <div className="p-2 flex gap-2">
              <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Group
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a New Group</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={createGroupForm.handleSubmit(async (data) => {
                      await createGroup(data);
                      setShowCreateGroup(false);
                      createGroupForm.reset();
                    })}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="name">Group Name</Label>
                      <Input id="name" {...createGroupForm.register("name")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">
                        Group Address
                        <span className="text-sm text-muted-foreground ml-2">
                          (letters, numbers, and hyphens only)
                        </span>
                      </Label>
                      <Input id="address" {...createGroupForm.register("address")} />
                    </div>
                    <Button type="submit" className="w-full">
                      Create Group
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={showJoinGroup} onOpenChange={setShowJoinGroup}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Hash className="h-4 w-4 mr-2" />
                    Join Group
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join a Group</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="group-address">Group Address</Label>
                      <Input
                        id="group-address"
                        value={groupAddress}
                        onChange={(e) => setGroupAddress(e.target.value)}
                        placeholder="Enter group address"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={async () => {
                        if (groupAddress) {
                          await joinGroup(groupAddress);
                          setShowJoinGroup(false);
                          setGroupAddress("");
                        }
                      }}
                    >
                      Join Group
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="flex-1">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-accent transition-colors",
                    selectedGroup?.id === group.id && "bg-accent"
                  )}
                  onClick={() => {
                    selectGroup(group);
                    selectUser(null);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarFallback>
                        <Hash className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{group.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {group.address}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser && (
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
                        {'delivered' in message && message.senderId === user?.id && (
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
        )}

        {selectedGroup && (
          <>
            <div className="p-4 border-b">
              <div className="font-semibold">{selectedGroup.name}</div>
              <div className="text-sm text-muted-foreground">
                Group Address: {selectedGroup.address}
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
        )}

        {!selectedUser && !selectedGroup && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat or group to start messaging
          </div>
        )}
      </div>
    </div>
  );
}