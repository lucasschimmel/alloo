import { builtinModules } from "node:module";
import { posix } from "node:path";
import type { Source, Workspace } from "./source";

const allowed: Record<string, string[]> = {
  alloo: ["@alloo/shared"],
  "@alloo/web": ["@alloo/backend", "@alloo/shared", "@alloo/ui", "@alloo/config"],
  "@alloo/landing": ["@alloo/shared", "@alloo/ui", "@alloo/config"],
  "@alloo/backend": ["@alloo/shared"],
  "@alloo/shared": [],
  "@alloo/ui": [],
  "@alloo/config": [],
};
const packageName = (specifier: string) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
const testing = (path: string) => /\.(?:test|spec)\.[jt]sx?$/.test(path);

const dependencies = (workspace: Workspace) => ({
  ...workspace.dependencies,
  ...workspace.devDependencies,
  ...workspace.peerDependencies,
});
type Owner = (path: string) => Workspace | undefined;

function manifestIssues(workspaces: Workspace[], byName: Map<string, Workspace>) {
  const issues: string[] = [];
  const edges = new Map<string, string[]>();
  const versions = new Map<string, string>();
  for (const workspace of workspaces) {
    const deps = dependencies(workspace);
    const internal = Object.keys(deps).filter((name) => name.startsWith("@alloo/"));
    edges.set(workspace.name, internal);
    for (const name of internal)
      if (!byName.has(name) || !allowed[workspace.name]?.includes(name))
        issues.push(`${workspace.name}: forbidden dependency ${name}`);
    for (const [name, version] of Object.entries(deps)) {
      const previous = versions.get(name);
      if (previous && previous !== version)
        issues.push(`${name}: inconsistent versions ${previous} / ${version}`);
      versions.set(name, version);
    }
    for (const key of Object.keys(workspace.exports ?? {}))
      if (key.includes("*")) issues.push(`${workspace.name}: wildcard export ${key}`);
  }
  const visit = (name: string, ancestors: string[]) => {
    if (ancestors.includes(name)) {
      issues.push(`Dependency cycle: ${[...ancestors, name].join(" -> ")}`);
      return;
    }
    for (const next of edges.get(name) ?? []) visit(next, [...ancestors, name]);
  };
  for (const workspace of workspaces) visit(workspace.name, []);
  return issues;
}

// One per-import decision tree distinguishes relative paths, Node builtins and public package imports.
function importIssues(
  specifier: string,
  source: Source,
  workspace: Workspace,
  owner: Owner,
  byName: Map<string, Workspace>,
) {
  const issues: string[] = [];

  if (specifier.startsWith(".")) {
    const target = owner(posix.normalize(posix.join(posix.dirname(source.path), specifier)));
    if (target?.name !== workspace.name)
      issues.push(`${source.path}: relative import escapes workspace (${specifier})`);
    return issues;
  }
  if (specifier.startsWith("node:") || builtinModules.includes(specifier)) {
    if (
      !testing(source.path) &&
      (workspace.name === "@alloo/shared" ||
        (source.path.includes("/src/") &&
          ["@alloo/web", "@alloo/landing", "@alloo/ui"].includes(workspace.name)))
    )
      issues.push(`${source.path}: Node builtin in browser-facing source (${specifier})`);
    return issues;
  }
  const name = packageName(specifier);
  const deps = dependencies(workspace);
  if (!deps[name]) issues.push(`${source.path}: undeclared dependency ${name}`);
  if (
    !testing(source.path) &&
    workspace.directory !== "." &&
    (source.path.includes("/src/") || source.path.includes("/convex/")) &&
    !workspace.dependencies?.[name] &&
    !workspace.peerDependencies?.[name] &&
    workspace.devDependencies?.[name]
  )
    issues.push(`${source.path}: development dependency in production (${name})`);
  const target = byName.get(name);
  if (target) {
    const subpath = `.${specifier.slice(name.length)}`;
    if (!target.exports?.[subpath])
      issues.push(`${source.path}: non-public package import ${specifier}`);
    if (name === "@alloo/config" && source.path.includes("/src/"))
      issues.push(`${source.path}: build configuration imported into runtime`);
  }
  return issues;
}

export function architectureIssues(workspaces: Workspace[], sources: Source[]): string[] {
  const byName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));
  const issues = manifestIssues(workspaces, byName);
  const owner: Owner = (path) =>
    workspaces.find(
      (workspace) => workspace.directory !== "." && path.startsWith(`${workspace.directory}/`),
    ) ?? workspaces.find((workspace) => workspace.directory === ".");
  for (const source of sources) {
    const workspace = owner(source.path);
    if (!workspace) continue;
    if (source.lines > 400)
      issues.push(`${source.path}: ${source.lines} lines exceeds the 400-line module budget`);
    for (const specifier of source.imports)
      issues.push(...importIssues(specifier, source, workspace, owner, byName));
  }
  return [...new Set(issues)];
}
