import { expect, it } from "vitest";
import { architectureIssues } from "./rules";
import { importsIn, type Workspace } from "./source";

const shared: Workspace = {
  name: "@alloo/shared",
  directory: "packages/shared",
  exports: { "./policy": "./src/policy.ts" },
};
const web: Workspace = {
  name: "@alloo/web",
  directory: "apps/web",
  dependencies: { "@alloo/shared": "workspace:*" },
};
const source = (imports: string[]) => ({ path: "apps/web/src/app.ts", imports, lines: 20 });

it("T-AC-91 detects forbidden imports after templates, JSX and regular expressions", () => {
  const code =
    // biome-ignore lint/suspicious/noTemplateCurlyInString: The parser fixture must contain literal interpolation syntax.
    'const label = `hello ${name}`; const view = <span>{label}</span>; const pattern = /[{}]/; const backend = import("@alloo/backend/convex/access");';
  const imports = importsIn("view.tsx", code);
  expect(imports).toEqual(["@alloo/backend/convex/access"]);
  expect(
    architectureIssues([shared], [{ path: "packages/shared/src/view.tsx", imports, lines: 1 }]),
  ).toEqual(expect.arrayContaining([expect.stringContaining("undeclared dependency")]));
});

it("T-AC-91 keeps development dependencies out of production modules", () => {
  expect(
    architectureIssues(
      [{ ...web, devDependencies: { vitest: "5.0.4" } }, shared],
      [source(["vitest"])],
    ),
  ).toEqual([expect.stringContaining("development dependency in production")]);
});

it("T-AC-91 rejects unresolvable computed loads and tracks inline type imports", () => {
  expect(() => importsIn("dynamic.ts", "const module = import(path);")).toThrow(
    "computed module loads",
  );
  expect(
    importsIn("types.ts", 'type Model = import("@alloo/backend/dataModel").Doc<"users">;'),
  ).toEqual(["@alloo/backend/dataModel"]);
});

it("T-AC-91 detects imports, re-exports and dynamic loads without matching comments", () => {
  expect(
    importsIn(
      "sample.ts",
      `// import 'fake';
    import type { A } from '@alloo/shared/policy';
    export { B } from 'another-package';
    const lazy = import('dynamic-package');
    const legacy = require('legacy-package');`,
    ),
  ).toEqual(["@alloo/shared/policy", "another-package", "dynamic-package", "legacy-package"]);
  expect(importsIn("sample.css", '@import "@alloo/ui/chat.css";')).toEqual(["@alloo/ui/chat.css"]);
});
it("T-AC-91 allows declared public imports and rejects private or undeclared paths", () => {
  expect(architectureIssues([web, shared], [source(["@alloo/shared/policy"])])).toEqual([]);
  expect(
    architectureIssues([web, shared], [source(["@alloo/shared/src/policy", "missing-package"])]),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("non-public package import"),
      expect.stringContaining("undeclared dependency"),
    ]),
  );
});
it("T-AC-91 rejects cross-workspace relative imports and Node code in browser source", () => {
  expect(
    architectureIssues([web, shared], [source(["../../../packages/shared/src/policy", "node:fs"])]),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("relative import escapes"),
      expect.stringContaining("Node builtin"),
    ]),
  );
});
it("T-AC-91 rejects reverse dependencies, cycles, version drift, wildcards and oversized modules", () => {
  const reverse = {
    ...shared,
    dependencies: { "@alloo/web": "workspace:*", example: "2.0.0" },
    exports: { "./*": "./src/*.ts" },
  };
  const consumer = { ...web, dependencies: { ...web.dependencies, example: "1.0.0" } };
  const issues = architectureIssues([consumer, reverse], [{ ...source([]), lines: 401 }]);
  for (const text of [
    "forbidden dependency",
    "Dependency cycle",
    "inconsistent versions",
    "wildcard export",
    "400-line",
  ])
    expect(issues.some((issue) => issue.includes(text))).toBe(true);
});
