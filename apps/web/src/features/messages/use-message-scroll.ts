import { api } from "@alloo/backend/api";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMutation } from "convex/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { explain } from "../../lib/errors";
import type { Message } from "./message-item";

// Scroll anchoring and visible-tab read cursors share the same viewport lifetime.
export function useMessageScroll(messages: Message[], notify: (text: string) => void) {
  const [atBottom, setAtBottom] = useState(true);
  const latest = messages.at(-1);
  const markRead = useMutation(api.messages.markRead);
  const scroll = useRef<HTMLDivElement>(null),
    following = useRef(true),
    lastCount = useRef(0),
    prepend = useRef<{ height: number; top: number } | null>(null),
    lastRead = useRef<string | undefined>(undefined);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 105,
    getItemKey: (index) => messages[index]._id,
    overscan: 8,
  });
  useLayoutEffect(() => {
    if (!scroll.current) return;
    if (prepend.current && messages.length > lastCount.current) {
      scroll.current.scrollTop += scroll.current.scrollHeight - prepend.current.height;
      prepend.current = null;
    } else if (following.current && messages.length)
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    lastCount.current = messages.length;
  }, [messages.length, virtualizer]);
  useEffect(() => {
    function update() {
      if (
        latest &&
        atBottom &&
        document.visibilityState === "visible" &&
        lastRead.current !== latest._id
      ) {
        lastRead.current = latest._id;
        void markRead({ messageId: latest._id }).catch((e) => {
          lastRead.current = undefined;
          notify(explain(e));
        });
      }
    }
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [latest, atBottom, markRead, notify]);
  return { scroll, following, prepend, virtualizer, atBottom, setAtBottom };
}
