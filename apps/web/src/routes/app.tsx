import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "../features/auth/auth-gate";
import { Backend } from "../lib/backend";
export const Route = createFileRoute("/app")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { conversation?: string; invite?: string } => ({
    conversation:
      typeof search.conversation === "string" ? search.conversation.slice(0, 100) : undefined,
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  component: () => (
    <Backend>
      <AuthGate />
    </Backend>
  ),
});
