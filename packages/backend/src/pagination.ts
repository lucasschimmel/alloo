import type { PaginationOptions } from "convex/server";

export function boundedPage(options: PaginationOptions, maximum = 100): PaginationOptions {
  return { ...options, numItems: Math.max(1, Math.min(maximum, options.numItems)) };
}
