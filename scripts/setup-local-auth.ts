import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";

// Local development only. Values stay in child-process pipes, never terminal titles.
if (process.env.CONVEX_AGENT_MODE !== "anonymous") throw new Error("Local anonymous mode required");
if (
  !process.env.CONVEX_DEPLOYMENT?.startsWith("anonymous:") ||
  !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(process.env.VITE_CONVEX_URL ?? "")
) {
  throw new Error("Refusing non-local deployment; initialize anonymous Convex first");
}
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const entries = {
  JWT_PRIVATE_KEY: privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString()
    .replace(/\n/g, " ")
    .trim(),
  JWKS: JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), use: "sig" }] }),
  SITE_URL: "http://127.0.0.1:3000",
  ALLOO_DEV_AUTH: "true",
};
for (const [name, value] of Object.entries(entries)) {
  const result = spawnSync(
    "node",
    ["node_modules/convex/bin/main.js", "env", "set", "--", name, value],
    { stdio: "pipe", windowsHide: true },
  );
  if (result.status !== 0) throw new Error(`Could not configure ${name}; output withheld`);
}
console.log("Local auth configuration rotated successfully. Values withheld.");
