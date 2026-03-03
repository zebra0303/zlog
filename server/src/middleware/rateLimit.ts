import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyFn?: (c: Context) => string;
  message?: string;
}

// Extract client IP from common proxy headers
function getClientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return c.req.header("x-real-ip") ?? "unknown";
}

/**
 * In-memory rate limiter middleware for Hono.
 * Uses a Map-based store with periodic cleanup of expired entries.
 */
export function rateLimit(storeKey: string, options: RateLimitOptions = {}) {
  const {
    windowMs = 60_000,
    max = 60,
    keyFn = getClientIp,
    message = "Too many requests, please try again later.",
  } = options;

  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup of expired entries (every 60s)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  cleanup.unref();

  return async (c: Context, next: Next) => {
    // Skip rate limiting in test environment to avoid interfering with test suites
    if (process.env.NODE_ENV === "test") return next();
    const ip = keyFn(c);
    const fullKey = `${storeKey}:${ip}`;
    const now = Date.now();

    let entry = store.get(fullKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(fullKey, entry);
    }

    entry.count++;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: message }, 429);
    }

    await next();
  };
}
