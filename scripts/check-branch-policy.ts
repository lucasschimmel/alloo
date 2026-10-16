import { readFileSync } from "node:fs";
import { branchPolicyIssues } from "./git/branch-policy";

if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
  console.log("Branch policy is enforced on pull requests.");
} else {
  if (!process.env.GITHUB_EVENT_PATH) throw new Error("Missing pull request event");
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) as {
    pull_request: {
      base: { ref: string };
      head: { ref: string };
      title: string;
      body: string | null;
    };
  };
  const pr = event.pull_request;
  const issues = branchPolicyIssues(pr.base.ref, pr.head.ref, pr.title, pr.body ?? "");
  if (issues.length) {
    for (const issue of issues) console.error(issue);
    process.exitCode = 1;
  } else console.log("Branch and release policy passed.");
}
