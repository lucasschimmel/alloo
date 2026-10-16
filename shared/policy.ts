import type { PaginationOptions } from "convex/server";
import emojiRegex from "emoji-regex";
export const LIMITS = {
  message: 4000,
  bio: 160,
  name: 60,
  group: 100,
  page: 40,
  avatarBytes: 5 * 1024 * 1024,
  avatarPixels: 1_048_576,
  ringingMs: 30_000,
  reconnectMs: 15_000,
  connectMs: 30_000,
  leaseMs: 60_000,
  heartbeatMs: 15_000,
  typingMs: 4000,
  presenceMs: 60_000,
  inviteMs: 7 * 24 * 60 * 60 * 1000,
} as const;
export function boundedPage(options: PaginationOptions, maximum = 100): PaginationOptions {
  return { ...options, numItems: Math.max(1, Math.min(maximum, options.numItems)) };
}
export const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"] as const;
// Generated Unicode sequences also work on browsers without RegExp's newer v flag.
export function validReaction(value: string) {
  return value.length > 0 && value.length <= 32 && emojiRegex().exec(value)?.[0] === value;
}
export function canonicalPair(a: string, b: string) {
  if (a === b) throw new Error("SELF_DM");
  return [a, b].sort().join(":");
}
export function cleanText(value: string, max: number) {
  const text = value.trim();
  if (!text || text.length > max) throw new Error("INVALID_INPUT");
  return text;
}
export function username(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(normalized)) throw new Error("INVALID_USERNAME");
  return normalized;
}
