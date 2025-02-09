import { createContext, ReactNode, useContext, useCallback, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Group, InsertGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "./use-toast";

type GroupsContextType = {
  groups: Group[];
  isLoading: boolean;
  createGroup: (data: InsertGroup) => Promise<void>;
  joinGroup: (address: string) => Promise<void>;
  selectedGroup: Group | null;
  selectGroup: (group: Group | null) => void;
};

const GroupsContext = createContext<GroupsContextType | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups/me"],
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: InsertGroup) => {
      const res = await apiRequest("POST", "/api/groups", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/me"] });
      toast({
        title: "Success",
        description: "Group created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await apiRequest("GET", `/api/groups/${address}`);
      return await res.json();
    },
    onSuccess: (group: Group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/me"] });
      toast({
        title: "Success",
        description: `Joined group ${group.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to join group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createGroup = useCallback(async (data: InsertGroup) => {
    await createGroupMutation.mutateAsync(data);
  }, [createGroupMutation]);

  const joinGroup = useCallback(async (address: string) => {
    await joinGroupMutation.mutateAsync(address);
  }, [joinGroupMutation]);

  const selectGroup = useCallback((group: Group | null) => {
    setSelectedGroup(group);
  }, []);

  const value = useMemo(
    () => ({
      groups,
      isLoading,
      createGroup,
      joinGroup,
      selectedGroup,
      selectGroup,
    }),
    [groups, isLoading, createGroup, joinGroup, selectedGroup, selectGroup]
  );

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupsContext);
  if (!context) {
    throw new Error("useGroups must be used within a GroupsProvider");
  }
  return context;
}