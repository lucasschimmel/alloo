"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatView } from "@/components/chat/chat-view";
import { EmptyState } from "@/components/chat/empty-state";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function ChatPage() {
  const [selectedConversation, setSelectedConversation] =
    useState<Id<"conversations"> | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const handleSelectConversation = useCallback(
    (id: Id<"conversations">) => {
      setSelectedConversation(id);
      setMobileShowChat(true);
    },
    []
  );

  const handleBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  return (
    <>
      <div
        className={`w-full md:w-80 md:block border-r border-border flex-shrink-0 ${
          mobileShowChat ? "hidden" : "block"
        }`}
      >
        <Sidebar
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
        />
      </div>
      <div
        className={`flex-1 ${mobileShowChat ? "block" : "hidden"} md:block`}
      >
        {selectedConversation ? (
          <ChatView
            conversationId={selectedConversation}
            onBack={handleBack}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}
