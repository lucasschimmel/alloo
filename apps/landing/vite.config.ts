import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Convex owns backend secrets; the frontend Worker must not inherit local dotenv values.
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";

export default defineConfig({
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" }, inspectorPort: false }),
    tailwind(),
    tanstackStart(),
    react(),
  ],
  server: { port: Number(process.env.LANDING_PORT ?? 3001) },
});
