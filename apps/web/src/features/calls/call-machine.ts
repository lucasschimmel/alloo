import { createMachine } from "xstate";
export const callMachine = createMachine({
  id: "call",
  initial: "idle",
  states: {
    idle: { on: { START: "preparing" } },
    preparing: { on: { READY: "ringing", CONNECTED: "active", END: "idle" } },
    ringing: { on: { CONNECT: "connecting", CONNECTED: "active", END: "idle" } },
    connecting: { on: { CONNECTED: "active", END: "idle" } },
    active: { on: { RECONNECT: "reconnecting", END: "idle" } },
    reconnecting: { on: { CONNECTED: "active", END: "idle" } },
  },
});
