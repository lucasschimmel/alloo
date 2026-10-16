import { convexTest } from "convex-test";
import schema from "./convex/schema";

/** Shared account fixture; each suite supplies its own isolated module loader. */
export async function setupUsers(modules: Record<string, () => Promise<unknown>>) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ids = [];
    for (const name of ["Alice", "Bob", "Carol"]) {
      const id = await ctx.db.insert("users", { name });
      await ctx.db.insert("profiles", { userId: id, name, username: name.toLowerCase(), bio: "" });
      ids.push(id);
    }
    return ids;
  });
  return {
    t,
    ids,
    a: t.withIdentity({ subject: ids[0] }),
    b: t.withIdentity({ subject: ids[1] }),
    c: t.withIdentity({ subject: ids[2] }),
  };
}
