import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { frontendReleaseIssues, releaseTargetIssues } from "@alloo/shared/release";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
const issues = frontendReleaseIssues(process.env);
if (issues.length) {
  console.error(`Release blocked: configure ${issues.join(", ")}. Values are never printed.`);
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ["x", "convex", "run", "--prod", "deployment:readiness", "{}"],
  {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  },
);
if (result.status !== 0) {
  console.error(
    "Release blocked: production Convex readiness could not be verified. Authenticate the CLI and deploy the backend first.",
  );
  process.exit(1);
}
try {
  const report = JSON.parse(result.stdout) as {
    issues: string[];
    siteUrl: string;
    backendUrl: string;
  };
  report.issues.push(...releaseTargetIssues(process.env, report));
  if (report.issues.length) {
    console.error(`Release blocked: backend checks failed (${report.issues.join(", ")}).`);
    process.exit(1);
  }
  console.log(
    "Release configuration checks passed. Live provider and recovery exercises remain mandatory.",
  );
} catch {
  console.error("Release blocked: invalid readiness response.");
  process.exit(1);
}
