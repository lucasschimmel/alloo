type Environment = Record<string, string | undefined>;
export function releaseTargetIssues(
  env: Environment,
  report: { siteUrl: string | null; backendUrl: string | null },
) {
  return [
    ...(report.siteUrl !== env.ALLOO_PUBLIC_ORIGIN ? ["SITE_URL_ORIGIN_MISMATCH"] : []),
    ...(report.backendUrl !== env.VITE_CONVEX_URL ? ["BACKEND_URL_MISMATCH"] : []),
  ];
}
export function httpsOrigin(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.origin === value &&
      url.hostname !== "localhost" &&
      !url.hostname.endsWith(".test") &&
      url.hostname !== "127.0.0.1"
    );
  } catch {
    return false;
  }
}
export function frontendReleaseIssues(env: Environment) {
  const issues = [];
  if (!httpsOrigin(env.VITE_LANDING_ORIGIN)) issues.push("VITE_LANDING_ORIGIN");
  if (!httpsOrigin(env.VITE_APP_ORIGIN) || env.VITE_APP_ORIGIN !== env.ALLOO_PUBLIC_ORIGIN)
    issues.push("VITE_APP_ORIGIN");
  if (!httpsOrigin(env.ALLOO_PUBLIC_ORIGIN)) issues.push("ALLOO_PUBLIC_ORIGIN");
  if (
    !httpsOrigin(env.VITE_CONVEX_URL) ||
    !new URL(env.VITE_CONVEX_URL ?? "").hostname.endsWith(".convex.cloud")
  )
    issues.push("VITE_CONVEX_URL");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_SUPPORT_EMAIL ?? ""))
    issues.push("VITE_SUPPORT_EMAIL");
  return issues;
}
export function backendReleaseIssues(env: Environment) {
  const issues = [];
  if (!httpsOrigin(env.SITE_URL)) issues.push("SITE_URL");
  for (const name of [
    "JWT_PRIVATE_KEY",
    "JWKS",
    "AUTH_RESEND_KEY",
    "AUTH_EMAIL_FROM",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
    "TURN_SHARED_SECRET",
    "ALLOO_OPERATOR_IDS",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ])
    if (!env[name]?.trim()) issues.push(name);
  if (!env.TURN_URLS?.split(",").every((url) => /^turns?:[^\s,]+$/.test(url.trim())))
    issues.push("TURN_URLS");
  for (const name of ["ALLOO_DEV_AUTH", "ALLOO_DEV_DIRECT_CALLS"])
    if (env[name] === "true") issues.push(name);
  return issues;
}
