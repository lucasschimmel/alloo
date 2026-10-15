import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Deliberately scoped fault injection, not a claim of whole-repository mutation coverage.
// Each case runs in an isolated ignored copy; the live application is never mutated.
const root = process.cwd();
const sandbox = join(root, ".claude", "crafts", "alloo-v2", "mutation", String(Date.now()));
mkdirSync(sandbox, { recursive: true });
for (const name of ["convex", "shared", "src"])
  cpSync(join(root, name), join(sandbox, name), { recursive: true });
writeFileSync(join(sandbox, "package.json"), JSON.stringify({ type: "module" }));
const cases = [
  {
    name: "block policy bypass",
    file: "convex/access.ts",
    from: "return rows.some(Boolean);",
    to: "return false;",
  },
  {
    name: "call session ownership bypass",
    file: "convex/calls.ts",
    from: "if (!expected || expected !== session)",
    to: "if (false)",
  },
  {
    name: "duplicate terminal history",
    file: "convex/callLifecycle.ts",
    from: 'if (call.state === "ended") return;',
    to: "",
  },
  {
    name: "self-DM allowed",
    file: "shared/policy.ts",
    from: 'if (a === b) throw new Error("SELF_DM");',
    to: "",
  },
];
function run() {
  return spawnSync(
    process.execPath,
    [
      resolve("node_modules/vitest/vitest.mjs"),
      "run",
      "--root",
      sandbox,
      "--config",
      resolve("vitest.config.ts"),
    ],
    { cwd: root, encoding: "utf8", timeout: 60_000, windowsHide: true },
  );
}
const baseline = run();
if (baseline.status !== 0)
  throw new Error("Mutation baseline failed; inspect isolated fixture before proceeding");
const results = [];
for (const item of cases) {
  const path = join(sandbox, item.file),
    original = readFileSync(path, "utf8");
  if (!original.includes(item.from)) throw new Error(`Mutation target drifted: ${item.name}`);
  try {
    writeFileSync(path, original.replace(item.from, item.to));
    const result = run();
    const killed = result.status !== 0 && /Tests\s+.*failed/.test(result.stdout + result.stderr);
    results.push({ name: item.name, killed });
    console.log(`${killed ? "KILLED" : "UNCONFIRMED"}: ${item.name}`);
  } finally {
    writeFileSync(path, original);
  }
}
writeFileSync(
  join(root, ".claude/crafts/alloo-v2/mutation-results.json"),
  JSON.stringify(
    { baseline: "passed", scope: "four hand-selected critical fault injections", results },
    null,
    2,
  ),
);
if (results.some((r) => !r.killed)) process.exitCode = 1;
