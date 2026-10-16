import { fileURLToPath } from "node:url";
import { frontendConfig } from "@alloo/config/vite";

export default frontendConfig({
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  port: Number(process.env.LANDING_PORT ?? 3001),
});
