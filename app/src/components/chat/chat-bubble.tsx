"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatMessageTime } from "@/lib/format-time";

interface ChatBubbleProps {
  content: string;
  sender: {
    _id: string;
    username?: string;
    displayName?: string;
    name?: string;
    image?: string;
  } | null;
  isOwn: boolean;
  timestamp: number;
  showSender: boolean;
  onSenderClick?: () => void;
}

export const ChatBubble = memo(function ChatBubble({
  content,
  sender,
  isOwn,
  timestamp,
  showSender,
  onSenderClick,
}: ChatBubbleProps) {
  const time = formatMessageTime(timestamp);
  const senderDisplayName = sender?.displayName ?? sender?.name ?? sender?.username ?? "Inconnu";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn("flex gap-2", isOwn ? "justify-end" : "justify-start")}
    >
      {/* Avatar for received messages in groups */}
      {showSender && !isOwn && sender && (
        <button
          type="button"
          onClick={onSenderClick}
          className="mt-auto flex-shrink-0 hover:opacity-80 transition-opacity"
        >
          <UserAvatar
            src={sender.image}
            fallback={senderDisplayName}
            size="xs"
          />
        </button>
      )}

      <div
        className={cn("max-w-[70%] space-y-0.5", isOwn ? "items-end" : "items-start")}
      >
        {showSender && !isOwn && sender && (
          <button
            type="button"
            onClick={onSenderClick}
            className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {senderDisplayName}
          </button>
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
