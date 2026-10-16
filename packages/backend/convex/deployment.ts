import { backendReleaseIssues } from "@alloo/shared/release";
import { internalQuery } from "./_generated/server";

// CLI-only diagnostics: return missing setting names, never values or signing material.
export const readiness = internalQuery({
  args: {},
  handler: () => ({
    issues: backendReleaseIssues(process.env),
    siteUrl: process.env.SITE_URL ?? null,
    backendUrl: process.env.CONVEX_CLOUD_URL ?? null,
  }),
});
