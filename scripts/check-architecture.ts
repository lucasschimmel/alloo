import { architectureIssues } from "./architecture/rules";
import { sourceFiles, workspaceManifests } from "./architecture/source";

const root = process.cwd();
const workspaces = workspaceManifests(root);
const sources = sourceFiles(root);
const issues = architectureIssues(workspaces, sources);
for (const issue of issues) console.error(issue);
if (issues.length) process.exitCode = 1;
else
  console.log(
    `Architecture passed: ${workspaces.length - 1} workspaces, ${sources.length} source files; declared imports, public exports, dependency directions, cycles and module sizes checked.`,
  );
