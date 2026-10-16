import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Shared build policy; application roots, ports and environment locations stay explicit. */
export function frontendConfig({ envDir, port }: { envDir: string; port: number }) {
  // Convex owns backend secrets; Worker bindings must not inherit local dotenv values.
  process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";
  return defineConfig({
    envDir,
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" }, inspectorPort: false }),
      tailwind(),
      tanstackStart(),
      react(),
    ],
    server: { port },
  });
}
