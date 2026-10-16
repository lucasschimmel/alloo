import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = process.env.ALLOO_TEST_ROOT ?? fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@alloo\/shared\/(.+)$/, replacement: `${root}/packages/shared/src/$1` },
      {
        find: /^@alloo\/backend\/(.+)$/,
        replacement: `${root}/packages/backend/convex/_generated/$1`,
      },
    ],
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
