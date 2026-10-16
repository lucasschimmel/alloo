import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: `${import.meta.env.VITE_LANDING_ORIGIN ?? "http://127.0.0.1:3001"}/` });
  },
});
