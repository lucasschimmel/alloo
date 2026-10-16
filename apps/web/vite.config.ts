import { fileURLToPath } from "node:url";
import { frontendConfig } from "@alloo/config/vite";

export default frontendConfig({
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  port: Number(process.env.WEB_PORT ?? process.env.PORT ?? 3000),
});
