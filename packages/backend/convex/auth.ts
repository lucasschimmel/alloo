import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import type { ConvexCredentialsUserConfig } from "@convex-dev/auth/providers/ConvexCredentials";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { authSettings } from "./authSettings";
import { emailCode } from "./email";

const passwordProvider = Password({
  profile(params) {
    if (!authSettings().password) throw new Error("EMAIL_NOT_CONFIGURED");
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("INVALID_EMAIL");
    return { email };
  },
  validatePasswordRequirements(value) {
    if (typeof value !== "string" || value.length < 12 || value.length > 256)
      throw new Error("INVALID_PASSWORD");
  },
  ...(authSettings().recovery
    ? { reset: emailCode("password-reset"), verify: emailCode("email-verify") }
    : {}),
});
// Convex Auth exposes provider overrides in `options` at runtime but omits it from
// its public return type. Wrap the documented authorize contract before any OTP
// is replaced. Extra email providers cannot be invoked by the public signIn API.
const options = (passwordProvider as unknown as { options: ConvexCredentialsUserConfig }).options;
const authorize = options.authorize;
options.authorize = async (params, ctx) => {
  if (!authSettings().password) throw new Error("EMAIL_NOT_CONFIGURED");
  const email = String(params.email ?? "")
    .trim()
    .toLowerCase();
  if (email.length > 254) throw new Error("INVALID_EMAIL");
  if (
    !["signIn", "signUp", "reset", "reset-verification", "email-verification"].includes(
      String(params.flow),
    )
  )
    throw new Error("INVALID_FLOW");
  const canIssue =
    params.flow === "signUp" ||
    params.flow === "reset" ||
    params.flow === "email-verification" ||
    (params.flow === "signIn" &&
      (await ctx.runQuery(internal.authIssuance.needsVerification, { email })));
  if (!params.code && authSettings().recovery && canIssue) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
    const digest = Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, "0")).join(
      "",
    );
    await ctx.runMutation(internal.authIssuance.reserve, { digest });
  }
  return authorize({ ...params, email }, ctx);
};
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [passwordProvider, Google, GitHub],
});
