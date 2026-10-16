export const RELEASE_CONFIRMATIONS = [
  "Production providers and target devices validated.",
  "Backup restore and rollback exercised.",
  "Public support, privacy and retention information finalized.",
] as const;

export function branchPolicyIssues(base: string, head: string, title: string, body: string) {
  if (base !== "main") return [];
  const issues: string[] = [];
  if (head !== "develop") issues.push("Releases into main must come from develop.");
  if (!/^release(?:\([^)]*\))?:\s+\S/i.test(title))
    issues.push("Use a release: <version> pull request title.");
  const checked = body
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s+\[[xX]\]\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+\[[xX]\]\s+/, "").trim());
  for (const confirmation of RELEASE_CONFIRMATIONS)
    if (!checked.includes(confirmation)) issues.push(`Release evidence required: ${confirmation}`);
  return issues;
}
