import { query } from "./_generated/server";

export function authSettings() {
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.SITE_URL ?? "");
  const email = !!(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM);
  return {
    password: email || (local && process.env.ALLOO_DEV_AUTH === "true"),
    recovery: email,
    google: !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    github: !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET),
  };
}
export const capabilities = query({ args: {}, handler: () => authSettings() });
