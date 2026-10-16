import type { Id } from "@alloo/backend/dataModel";
import { createContext, type ReactNode, useContext } from "react";
import { CallPanel } from "./call-panel";
import { useCallSession } from "./use-call-session";

type CallContextValue = {
  start: (id: Id<"conversations">, kind: "audio" | "video") => Promise<void>;
};
const CallContext = createContext<CallContextValue | null>(null);
export function useCalls() {
  const value = useContext(CallContext);
  if (!value) throw new Error("Call provider missing");
  return value;
}
export function CallProvider({
  userId,
  children,
  notify,
}: {
  userId: Id<"users">;
  children: ReactNode;
  notify: (text: string) => void;
}) {
  const session = useCallSession(userId, notify);
  return (
    <CallContext.Provider value={{ start: (id, kind) => session.begin(id, kind) }}>
      {children}
      <CallPanel session={session} notify={notify} />
    </CallContext.Provider>
  );
}
