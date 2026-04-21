/**
 * In-memory sliding-window rate limiter.
 * Good for single-instance deployments.
 *
 * TODO: migrar a Redis/Upstash cuando haya múltiples instancias del server.
 * En serverless (Vercel Functions), cada instancia tiene su propio Map, así que
 * el rate limit se fragmenta. Para el piloto actual (Chile, 3-4 restaurantes,
 * una instancia) es suficiente. Para escalar, solo hay que cambiar la
 * implementación de `rateLimit()` sin tocar los endpoints que la usan.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 3600000); // keep last hour
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 300000);

interface RateLimitConfig {
  /** Max number of requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  /** Remaining requests in window */
  remaining: number;
  /** Milliseconds until the oldest request expires (for retry-after) */
  retryAfterMs: number;
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs);

  if (entry.timestamps.length >= config.limit) {
    // Rate limited
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = config.windowMs - (now - oldestInWindow);
    store.set(key, entry);
    return { success: false, remaining: 0, retryAfterMs };
  }

  // Allow request
  entry.timestamps.push(now);
  store.set(key, entry);
  return { success: true, remaining: config.limit - entry.timestamps.length, retryAfterMs: 0 };
}

// Preset configurations
export const RATE_LIMITS = {
  login: { limit: 5, windowMs: 15 * 60 * 1000 },          // 5 per 15 min
  forgotPassword: { limit: 3, windowMs: 60 * 60 * 1000 },  // 3 per hour
  resetPassword: { limit: 10, windowMs: 15 * 60 * 1000 },  // 10 per 15 min
} as const;

/** Extract client IP from request */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/** Format retry-after for user-friendly message */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes <= 1) return "1 minuto";
  return `${minutes} minutos`;
}
