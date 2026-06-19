import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { withApi } from "./http";
import { parseOr400, scoreSchema, simulateSchema } from "./validate";
import { _resetRateLimit } from "./ratelimit";

function post(body: unknown, key: string | null = "demo"): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-api-key"] = key;
  return new NextRequest("http://localhost/api/v1/score", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => _resetRateLimit());

describe("withApi cross-cutting + error mapping", () => {
  it("malformed address → 400, NOT 500", async () => {
    const handler = withApi("score", async ({ body }) => {
      const { address } = parseOr400(scoreSchema, body);
      return { data: { address } };
    });
    const res = await handler(post({ address: "not-an-address" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("invalid_input");
  });

  it("malformed simulate intent → 400, NOT 500", async () => {
    const handler = withApi("simulate", async ({ body }) => {
      const intent = parseOr400(simulateSchema, body);
      return { data: intent };
    });
    const res = await handler(post({ type: "approve", token: "0xnope", spender: "0xnope", amount: "1" }));
    expect(res.status).toBe(400);
  });

  it("invalid JSON body → 400", async () => {
    const handler = withApi("score", async () => ({ data: {} }));
    const res = await handler(post("{ not valid json", "demo"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("invalid_json");
  });

  it("missing API key → 401", async () => {
    const handler = withApi("score", async () => ({ data: {} }));
    const res = await handler(post({ address: "0x0000000000000000000000000000000000000000" }, null));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("unauthorized");
  });

  it("invalid API key → 401", async () => {
    const handler = withApi("score", async () => ({ data: {} }));
    const res = await handler(post({ x: 1 }, "definitely-not-a-real-key"));
    expect(res.status).toBe(401);
  });

  it("unexpected handler error → 500 with a safe message (no leak)", async () => {
    const handler = withApi("score", async () => {
      throw new Error("raw chain stacktrace secret");
    });
    const res = await handler(post({}));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("internal_error");
    expect(json.error.message).not.toContain("raw chain stacktrace secret");
  });

  it("valid handler → 200 with the { ok, data } envelope and CORS headers", async () => {
    const handler = withApi("score", async () => ({ data: { hello: "world" }, verdict: "ALLOW" }));
    const res = await handler(post({}));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const json = await res.json();
    expect(json).toEqual({ ok: true, data: { hello: "world" } });
  });

  it("enforces the rate limit (429 after the bucket drains)", async () => {
    const handler = withApi("score", async () => ({ data: { ok: 1 } }));
    let sawLimit = false;
    // Bucket capacity is 20; 25 immediate calls must trip the limiter.
    for (let i = 0; i < 25; i++) {
      const res = await handler(post({}));
      if (res.status === 429) {
        sawLimit = true;
        expect(res.headers.get("retry-after")).toBeTruthy();
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });
});
