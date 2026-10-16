import { api } from "@alloo/backend/api";
import type { Id } from "@alloo/backend/dataModel";
import { LIMITS } from "@alloo/shared/policy";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { explain } from "../../lib/errors";

export function usePresence(
  conversationId: Id<"conversations"> | undefined,
  notify: (text: string) => void,
) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const [session] = useState(() => crypto.randomUUID()),
    lastTyping = useRef(0);
  useEffect(() => {
    const beat = () =>
      void heartbeat({
        session,
        conversationId: conversationId,
        typing: false,
        online: true,
      }).catch((e) => notify(explain(e)));
    beat();
    const timer = setInterval(beat, LIMITS.heartbeatMs);
    return () => {
      clearInterval(timer);
      void heartbeat({ session, typing: false, online: false }).catch(() => {
        /* Lease expiry is the crash fallback; no private data is retained here. */
      });
    };
  }, [heartbeat, session, conversationId, notify]);
  function typing(value: boolean) {
    if (value && Date.now() - lastTyping.current < 2000) return;
    lastTyping.current = Date.now();
    void heartbeat({
      session,
      conversationId: conversationId,
      typing: value,
      online: true,
    }).catch((e) => notify(explain(e)));
  }
  return typing;
}
