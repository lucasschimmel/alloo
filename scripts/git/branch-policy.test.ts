import { expect, it } from "vitest";
import { branchPolicyIssues, RELEASE_CONFIRMATIONS } from "./branch-policy";

const evidence = RELEASE_CONFIRMATIONS.map((text) => `- [x] ${text}`).join("\n");
it("allows feature integration into develop without release claims", () => {
  expect(branchPolicyIssues("develop", "codex/v2-rebuild", "feat: V2", "")).toEqual([]);
});
it("allows a documented release from develop", () => {
  expect(branchPolicyIssues("main", "develop", "release: 2.0.0", evidence)).toEqual([]);
});
it("rejects features sent directly to main", () => {
  expect(branchPolicyIssues("main", "codex/feature", "release: 2.0.0", evidence)).toEqual([
    "Releases into main must come from develop.",
  ]);
});
it("rejects missing release identity and incomplete manual evidence", () => {
  expect(branchPolicyIssues("main", "develop", "feat: V2", "")).toHaveLength(4);
  expect(
    branchPolicyIssues("main", "develop", "release: 2.0.0", evidence.replaceAll("[x]", "[ ]")),
  ).toHaveLength(3);
});
