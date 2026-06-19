/**
 * HTTP plumbing — one response envelope and one wrapper that applies every
 * cross-cutting concern in order: CORS → auth → rate-limit → JSON parse →
 * handler → structured log. Every response is `{ ok, data? } | { ok, error }`
 * with a correct status code. Malformed input is a 400 (never a 500); only a
 * genuine server/chain fault is a 500.
 */
import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "./cors";
import { checkApiKey } from "./auth";
import { rateLimit } from "./ratelimit";
import { logRequest } from "./logger";

export interface ApiError {
  code: string;
  message: string;
}

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

/** Thrown by handlers/validators to map to a specific client-facing status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface HandlerResult<T> {
  data: T;
  /** Optional verdict + address, surfaced only to the structured log. */
  verdict?: string;
  address?: string;
}

type Handler<T> = (input: {
  body: unknown;
  req: NextRequest;
}) => Promise<HandlerResult<T>>;

function json<T>(
  body: ApiEnvelope<T>,
  status: number,
  headers: Record<string, string>,
  extra?: Record<string, string>
): NextResponse {
  return NextResponse.json(body, { status, headers: { ...headers, ...extra } });
}

export function withApi<T>(endpoint: string, handler: Handler<T>) {
  return async (req: NextRequest): Promise<Response> => {
    const started = Date.now();
    const cors = corsHeaders(req.headers.get("origin"));
    let verdict: string | undefined;
    let address: string | undefined;
    let keyKind: "demo" | "key" | undefined;

    const finish = (
      body: ApiEnvelope<T>,
      status: number,
      extra?: Record<string, string>
    ) => {
      logRequest({ endpoint, status, latencyMs: Date.now() - started, verdict, address, keyKind });
      return json(body, status, cors, extra);
    };

    try {
      // --- auth ---
      const auth = checkApiKey(req);
      if (!auth.ok) {
        return finish({ ok: false, error: { code: "unauthorized", message: auth.message } }, 401);
      }
      keyKind = auth.isDemo ? "demo" : "key";

      // --- rate limit ---
      const rl = rateLimit(auth.bucketKey);
      if (!rl.ok) {
        return finish(
          {
            ok: false,
            error: {
              code: "rate_limited",
              message: `Rate limit exceeded. Retry in ${rl.retryAfter}s. (In-memory limiter — see README for the Redis/Upstash upgrade.)`,
            },
          },
          429,
          {
            "Retry-After": String(rl.retryAfter),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
          }
        );
      }

      // --- body parse ---
      let body: unknown = {};
      const raw = await req.text();
      if (raw.length > 0) {
        try {
          body = JSON.parse(raw);
        } catch {
          throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
        }
      }

      // --- handler ---
      const result = await handler({ body, req });
      verdict = result.verdict;
      address = result.address;
      return finish({ ok: true, data: result.data }, 200);
    } catch (err) {
      if (err instanceof HttpError) {
        return finish({ ok: false, error: { code: err.code, message: err.message } }, err.status);
      }
      // Unexpected — log the real error server-side, return a safe message.
      // eslint-disable-next-line no-console
      console.error(`[risk-api:${endpoint}] unhandled error:`, err);
      return finish(
        {
          ok: false,
          error: {
            code: "internal_error",
            message:
              "An unexpected error occurred while reading Base. This is often a public-RPC throttle — retry shortly or configure BASE_RPC_URL with a dedicated key.",
          },
        },
        500
      );
    }
  };
}
