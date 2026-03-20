"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  content: string;
  sender: {
    _id: string;
    username?: string;
    name?: string;
    image?: string;
  } | null;
  isOwn: boolean;
  timestamp: number;
  showSender: boolean;
}

export const ChatBubble = memo(function ChatBubble({
  content,
  sender,
  isOwn,
  timestamp,
  showSender,
}: ChatBubbleProps) {
  const time = new Date(timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex", isOwn ? "justify-end" : "justify-start")}
    >
      <div
        className={cn("max-w-[75%] space-y-0.5", isOwn ? "items-end" : "items-start")}
      >
        {showSender && !isOwn && sender && (
          <p className="ml-3 text-xs font-medium text-muted-foreground">
            {sender.username ?? sender.name ?? "Inconnu"}
          </p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm leading-relaxed",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md"
          )}
        >
          {content}
        </div>
        <p
          className={cn(
            "px-1 text-[10px] text-muted-foreground",
            isOwn ? "text-right" : "text-left"
          )}
        >
          {time}
        </p>
      </div>
    </motion.div>
  );
});
