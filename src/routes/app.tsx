import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "../features/auth/auth-gate";
import { Backend } from "../lib/backend";
export const Route = createFileRoute("/app")({
  ssr: false,
  component: () => (
    <Backend>
      <AuthGate />
    </Backend>
  ),
});
