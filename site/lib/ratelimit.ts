/**
 * In-memory token-bucket rate limiter, keyed per API key (or demo-key + IP).
 *
 * PRODUCTION UPGRADE: this state lives in a single server instance's memory, so
 * it resets on redeploy and does NOT coordinate across instances. Swap this for
 * Redis / Upstash (a shared INCR with TTL, or a Lua token-bucket) before scaling
 * horizontally. The interface below is intentionally small so that swap is local.
 */

const CAPACITY = 20; // burst size
const REFILL_PER_SEC = 0.5; // sustained rate: 1 token every 2 seconds

interface Bucket {
  tokens: number;
  last: number; // ms timestamp of last refill
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until at least one token is available (0 when allowed). */
  retryAfter: number;
  limit: number;
}

export function rateLimit(key: string, now: number = Date.now()): RateLimitResult {
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: CAPACITY, last: now };
    buckets.set(key, b);
  }
  // Refill based on elapsed time.
  const elapsedSec = Math.max(0, (now - b.last) / 1000);
  b.tokens = Math.min(CAPACITY, b.tokens + elapsedSec * REFILL_PER_SEC);
  b.last = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens), retryAfter: 0, limit: CAPACITY };
  }
  const retryAfter = Math.ceil((1 - b.tokens) / REFILL_PER_SEC);
  return { ok: false, remaining: 0, retryAfter, limit: CAPACITY };
}

/** Test helper — clears all buckets. */
export function _resetRateLimit(): void {
  buckets.clear();
}
