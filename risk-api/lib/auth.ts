/**
 * API-key access — a STUB, by design (see README "What's a stub").
 *
 * Keys come from the RISK_API_KEYS env allowlist (comma-separated). The public
 * key `demo` is always accepted unless DISABLE_DEMO_KEY=1, so the developer
 * console's "try it" works out of the box. There is no billing, no persistence,
 * and no per-key scopes yet — the structure is here so those can be added.
 */
import { NextRequest } from "next/server";

export const DEMO_KEY = "demo";

/** The set of currently-accepted API keys (env allowlist + optional demo). */
export function validKeys(): Set<string> {
  const fromEnv = (process.env.RISK_API_KEYS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set(fromEnv);
  if (process.env.DISABLE_DEMO_KEY !== "1") set.add(DEMO_KEY);
  return set;
}

/** Best-effort client IP for fair rate-limiting of the shared demo key. */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Pull the key from the x-api-key header, Authorization: Bearer, or ?key=. */
export function extractKey(req: NextRequest): string | null {
  const header = req.headers.get("x-api-key");
  if (header) return header.trim();
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const qp = new URL(req.url).searchParams.get("key");
  return qp ? qp.trim() : null;
}

export type AuthResult =
  | { ok: true; key: string; isDemo: boolean; bucketKey: string }
  | { ok: false; message: string };

export function checkApiKey(req: NextRequest): AuthResult {
  const key = extractKey(req);
  if (!key) {
    return {
      ok: false,
      message:
        "Missing API key. Send it as the `x-api-key` header. Use `demo` to try the API.",
    };
  }
  if (!validKeys().has(key)) {
    return { ok: false, message: "Invalid API key." };
  }
  const isDemo = key === DEMO_KEY;
  // The shared demo key is bucketed per-IP so one caller can't starve others;
  // real keys get their own bucket.
  const bucketKey = isDemo ? `demo:${clientIp(req)}` : `key:${key}`;
  return { ok: true, key, isDemo, bucketKey };
}
