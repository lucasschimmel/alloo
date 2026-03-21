"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquarePlus, Users, Search, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthActions } from "@convex-dev/auth/react";
import { formatLastSeen } from "@/lib/format-time";

interface SidebarProps {
  selectedConversation: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
}

export function Sidebar({
  selectedConversation,
  onSelectConversation,
}: SidebarProps) {
  const conversations = useQuery(api.conversations.list);
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuthActions();
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h1 className="text-xl font-bold text-primary">Alloo</h1>
        <div className="flex items-center gap-1">
          <NewDMDialog open={showNewDM} onOpenChange={setShowNewDM} onSelectConversation={onSelectConversation} />
          <NewGroupDialog open={showNewGroup} onOpenChange={setShowNewGroup} onSelectConversation={onSelectConversation} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {conversations === undefined && (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}
          {conversations?.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Aucune conversation. Commence par envoyer un message !
            </p>
          )}
          {conversations?.map((conv) => {
            const otherMember =
              conv!.type === "dm"
                ? conv!.members.find((m: any) => m && m._id !== user?._id)
                : null;

            return (
              <button
                key={conv!._id}
                onClick={() => onSelectConversation(conv!._id)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted ${
                  selectedConversation === conv!._id ? "bg-muted" : ""
                }`}
              >
                <UserAvatar
                  src={otherMember?.image}
                  fallback={conv!.displayName ?? "?"}
                  isOnline={otherMember?.isOnline}
                  isGroup={conv!.type === "group"}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">
                      {conv!.type === "dm" && otherMember
                        ? (otherMember as any).displayName ?? otherMember.username ?? conv!.displayName
                        : conv!.displayName}
                    </span>
                    {(conv!.unreadCount ?? 0) > 0 && (
                      <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {conv!.unreadCount}
                      </span>
                    )}
                  </div>
                  {conv!.lastMessage && (
                    <p className="truncate text-xs text-muted-foreground">
                      {conv!.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="flex items-center gap-3 border-t border-border p-3">
        <UserAvatar
          src={user?.image}
          fallback={user?.displayName ?? user?.username ?? user?.name ?? "?"}
          size="sm"
        />
        <span className="flex-1 truncate text-sm font-medium">
          {user?.displayName ?? user?.username ?? user?.name ?? "Utilisateur"}
        </span>
        <Button variant="ghost" size="icon" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NewDMDialog({
  open,
  onOpenChange,
  onSelectConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (id: Id<"conversations">) => void;
}) {
  const [search, setSearch] = useState("");
  const results = useQuery(api.users.searchUsers, { query: search });
  const createDM = useMutation(api.conversations.createDM);

  const handleSelect = async (userId: Id<"users">) => {
    const conversationId = await createDM({ userId });
    onSelectConversation(conversationId);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" />}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {results?.map((u) => (
              <button
                key={u._id}
                onClick={() => handleSelect(u._id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted"
              >
                <UserAvatar
                  src={u.image}
                  fallback={u.displayName ?? u.username ?? "?"}
                  isOnline={u.isOnline}
                  size="sm"
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">
                    {u.displayName ?? u.name ?? u.username}
                  </p>
                  {u.username && (
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.username}
                    </p>
                  )}
                </div>
              </button>
            ))}
            {search.length >= 2 && results?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucun utilisateur trouvé
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewGroupDialog({
  open,
  onOpenChange,
  onSelectConversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConversation: (id: Id<"conversations">) => void;
}) {
  const [name, setName] = useState("");
  const createGroup = useMutation(api.conversations.createGroup);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await createGroup({ name: name.trim() });
      onSelectConversation(result.conversationId);
      onOpenChange(false);
      setName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" />}
      >
        <Users className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau groupe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            placeholder="Nom du groupe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Création..." : "Créer le groupe"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
