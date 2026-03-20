"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ChatBubble } from "./chat-bubble";
import { ChatInput } from "./chat-input";
import { TypingIndicator } from "./typing-indicator";
import { GroupInfo } from "./group-info";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, AlertCircle } from "lucide-react";

interface ChatViewProps {
  conversationId: Id<"conversations">;
  onBack: () => void;
}

export function ChatView({ conversationId, onBack }: ChatViewProps) {
  const messages = useQuery(api.messages.list, { conversationId });
  const conversation = useQuery(api.conversations.get, { conversationId });
  const markAsRead = useMutation(api.conversations.markAsRead);
  const { user } = useCurrentUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  useEffect(() => {
    if (messages && messages.length > 0) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      void markAsRead({ conversationId }).catch(() => {});
    }
  }, [messages, conversationId, markAsRead]);

  // Loading state (query returns undefined)
  if (conversation === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not found or not a member (query returns null)
  if (conversation === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Conversation introuvable</p>
          <p className="text-sm text-muted-foreground">
            Cette conversation n&apos;existe pas ou tu n&apos;y as plus accès.
          </p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
      </div>
    );
  }

  // Find the other user in DMs using current user's ID (not createdBy)
  const otherDmMember =
    conversation.type === "dm" && user
      ? conversation.members.find((m: any) => m && m._id !== user._id)
      : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {conversation.type === "group" ? (
              <Users className="h-4 w-4" />
            ) : (
              (conversation.displayName ?? "?")[0]?.toUpperCase()
            )}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {conversation.displayName}
          </h2>
          {conversation.type === "group" && (
            <p className="text-xs text-muted-foreground">
              {conversation.members.length} membres
            </p>
          )}
          {conversation.type === "dm" && otherDmMember && (
            <p className="text-xs text-muted-foreground">
              {otherDmMember.isOnline ? "En ligne" : "Hors ligne"}
            </p>
          )}
        </div>
        {conversation.type === "group" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowGroupInfo(!showGroupInfo)}
          >
            <Users className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages */}
        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-1">
              {messages?.map((msg) => (
                <ChatBubble
                  key={msg._id}
                  content={msg.content}
                  sender={msg.sender}
                  isOwn={msg.isOwn}
                  timestamp={msg._creationTime}
                  showSender={conversation.type === "group"}
                />
              ))}
            </div>
            <TypingIndicator conversationId={conversationId} />
          </div>
          <ChatInput conversationId={conversationId} />
        </div>

        {/* Group Info Panel */}
        {showGroupInfo && conversation.type === "group" && (
          <GroupInfo
            conversation={conversation}
            onClose={() => setShowGroupInfo(false)}
          />
        )}
      </div>
    </div>
  );
}
