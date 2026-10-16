export const OFFLINE = {
  ttlMs: 7 * 24 * 60 * 60 * 1000,
  items: 100,
  bytes: 50 * 1024 * 1024,
  leaseMs: 180_000,
  requestMs: 20_000,
  pollMs: 2000,
  retryMaxMs: 60_000,
  attempts: 8,
} as const;
export function retryDelay(attempt: number) {
  return Math.min(OFFLINE.retryMaxMs, 1000 * 2 ** Math.min(attempt, 6));
}
export function permanentSendError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return [
    "FORBIDDEN",
    "ACCOUNT_DELETED",
    "BLOCKED",
    "INVALID_REPLY",
    "CONFLICT",
    "INVALID_INPUT",
    "INVALID_ATTACHMENT",
  ].some((code) => text.includes(code));
}
