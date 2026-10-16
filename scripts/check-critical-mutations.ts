import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Deliberately scoped fault injection, not a claim of whole-repository mutation coverage.
// Each case runs in an isolated ignored copy; the live application is never mutated.
const root = process.cwd();
const sandbox = join(root, ".claude", "crafts", "alloo-v2", "mutation", String(Date.now()));
mkdirSync(sandbox, { recursive: true });
for (const name of [
  "packages/backend/convex",
  "packages/backend/src",
  "packages/backend/test-support.ts",
  "packages/shared/src",
  "apps/web/src",
  "apps/web/public",
])
  cpSync(join(root, name), join(sandbox, name), { recursive: true });
writeFileSync(join(sandbox, "package.json"), JSON.stringify({ type: "module" }));
// Bun isolates third-party dependencies per workspace. Reuse these installed packages;
// Vitest aliases still resolve every @alloo source import into the isolated copy.
for (const workspace of ["apps/web", "packages/backend", "packages/shared"]) {
  const installed = join(root, workspace, "node_modules");
  if (existsSync(installed))
    symlinkSync(installed, join(sandbox, workspace, "node_modules"), "junction");
}
const cases = [
  {
    name: "pre-onboarding deletion tombstone bypass",
    file: "packages/backend/convex/accounts.ts",
    from: "if (!p)",
    to: "if (false)",
  },
  {
    name: "conversation aggregate read budget bypass",
    file: "packages/shared/src/policy.ts",
    from: "conversationPage: 8",
    to: "conversationPage: 30",
  },
  {
    name: "scoped local deletion owner bypass",
    file: "apps/web/src/features/offline/store.ts",
    from: "expectedOwner && active?.owner !== expectedOwner",
    to: "false",
  },

  {
    name: "outbox account generation bypass",
    file: "apps/web/src/features/offline/store.ts",
    from: "current?.owner !== owner || current.generation !== generation",
    to: "false",
  },
  {
    name: "send expected account bypass",
    file: "packages/backend/convex/messages.ts",
    from: "args.expectedUserId && args.expectedUserId !== own.userId",
    to: "false",
  },
  {
    name: "push mute bypass",
    file: "packages/backend/convex/push.ts",
    from: "membership.muted || membership.readAt",
    to: "membership.readAt",
  },
  {
    name: "worker binding bypass",
    file: "apps/web/public/sw.js",
    from: "control.account === payload.account &&",
    to: "",
  },

  {
    name: "message author edit bypass",
    file: "packages/backend/convex/messages.ts",
    from: 'msg.userId !== own.userId || msg.kind !== "text"',
    to: 'msg.kind !== "text"',
  },
  {
    name: "attachment owner bypass",
    file: "packages/backend/convex/messages.ts",
    from: "file.userId !== own.userId ||",
    to: "",
  },
  {
    name: "attachment hidden download bypass",
    file: "packages/backend/convex/attachmentRecords.ts",
    from: " || hidden)",
    to: ")",
  },
  {
    name: "search conversation filter bypass",
    file: "packages/backend/convex/messages.ts",
    from: '.eq("conversationId", id).eq("kind", "text")',
    to: '.eq("kind", "text")',
  },

  {
    name: "PNG preflight bypass",
    file: "packages/backend/src/image.ts",
    from: "validatePng(input);",
    to: "",
  },
  {
    name: "call ownership identifiers exposed",
    file: "packages/backend/convex/calls.ts",
    from: "return view;",
    to: "return call;",
  },
  {
    name: "reply retry conflict ignored",
    file: "packages/shared/src/message-request.ts",
    from: "replyId ?? null",
    to: "null",
  },
  {
    name: "group creation cross-member block bypass",
    file: "packages/backend/convex/conversations.ts",
    from: "await assertCompatibleMembers(ctx, [], ids);",
    to: "",
  },
  {
    name: "SDP collision lock held until transport acknowledgement",
    file: "apps/web/src/features/calls/peer.ts",
    from: "this.makingOffer = false;\n          }",
    to: "await sent; this.makingOffer = false;\n          }",
  },
  {
    name: "empty group cleanup disabled",
    file: "packages/backend/convex/groupLifecycle.ts",
    from: "await ctx.scheduler.runAfter(0, internal.groupLifecycle.purge, { id });",
    to: "",
  },
  {
    name: "deleted last member can invite before cleanup",
    file: "packages/backend/src/invitations.ts",
    from: "!liveProfiles.some((p) => p && !p.deleted)",
    to: "false",
  },
  {
    name: "disconnected media ignored",
    file: "apps/web/src/features/calls/peer.ts",
    from: 'this.pc.connectionState === "disconnected"',
    to: "false",
  },
  {
    name: "translation direction hardcoded",
    file: "apps/web/src/features/messages/translation.ts",
    from: "const sourceLanguage = detected.detectedLanguage;",
    to: 'const sourceLanguage = "en";',
  },
  {
    name: "block policy bypass",
    file: "packages/backend/convex/access.ts",
    from: "return rows.some(Boolean);",
    to: "return false;",
  },
  {
    name: "call session ownership bypass",
    file: "packages/backend/convex/calls.ts",
    from: "if (!expected || expected !== session)",
    to: "if (false)",
  },
  {
    name: "duplicate terminal history",
    file: "packages/backend/convex/callLifecycle.ts",
    from: 'if (call.state === "ended") return;',
    to: "",
  },
  {
    name: "self-DM allowed",
    file: "packages/shared/src/policy.ts",
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
    {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
      windowsHide: true,
      env: { ...process.env, ALLOO_TEST_ROOT: sandbox },
    },
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
    { baseline: "passed", scope: "hand-selected critical fault injections", results },
    null,
    2,
  ),
);
if (results.some((r) => !r.killed)) process.exitCode = 1;
