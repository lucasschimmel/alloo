import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "@babel/parser";

export type Workspace = {
  name: string;
  directory: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: Record<string, string>;
};
export type Source = { path: string; imports: string[]; lines: number };

// A single AST walk handles statement, type and expression loads so their parser rules cannot diverge.
export function importsIn(path: string, text: string): string[] {
  if (path.endsWith(".css"))
    return [...text.matchAll(/@import\s+["']([^"']+)["']/g)].map((match) => match[1]);
  const ast = parse(text, {
    sourceType: "unambiguous",
    plugins: ["typescript", ...(path.endsWith(".tsx") ? ["jsx" as const] : [])],
  });
  const imports: string[] = [];
  function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  }
  function add(value: unknown) {
    const node = record(value);
    if (node?.type !== "StringLiteral")
      throw new Error(`${path}: computed module loads need an explicit architecture rule`);
    imports.push(String(node.value));
  }
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = record(value);
    if (!node) return;
    if (
      ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(
        String(node.type),
      ) &&
      node.source
    )
      add(node.source);
    if (node.type === "ImportExpression") add(node.source);
    if (node.type === "TSImportType") add(node.argument ?? node.source);
    const callee = record(node.callee);
    if (
      node.type === "CallExpression" &&
      (callee?.type === "Import" || (callee?.type === "Identifier" && callee.name === "require"))
    )
      add((node.arguments as unknown[])[0]);
    for (const [key, child] of Object.entries(node))
      if (
        ![
          "loc",
          "comments",
          "leadingComments",
          "trailingComments",
          "innerComments",
          "extra",
        ].includes(key)
      )
        visit(child);
  }
  visit(ast);
  return imports;
}

const ignored = new Set([
  "node_modules",
  "dist",
  "_generated",
  ".git",
  ".claude",
  ".codex",
  ".wrangler",
  ".tanstack",
  ".convex",
  "test-results",
  "playwright-report",
]);
export function sourceFiles(root: string, directory = root): Source[] {
  const result: Source[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...sourceFiles(root, path));
      continue;
    }
    if (
      !/\.(?:tsx?|js|css)$/.test(entry.name) ||
      entry.name.endsWith(".gen.ts") ||
      /(?:secret|credential|password|token|api_key)/i.test(entry.name)
    )
      continue;
    const text = readFileSync(path, "utf8");
    result.push({
      path: relative(root, path).replaceAll("\\", "/"),
      imports: importsIn(path, text),
      lines: text.trimEnd().split("\n").length,
    });
  }
  return result;
}

export function workspaceManifests(root: string): Workspace[] {
  const read = (directory: string): Workspace => ({
    ...JSON.parse(readFileSync(join(root, directory, "package.json"), "utf8")),
    directory,
  });
  return [
    read("."),
    ...["apps", "packages"].flatMap((parent) =>
      readdirSync(join(root, parent), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => read(`${parent}/${entry.name}`)),
    ),
  ];
}
