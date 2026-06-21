import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { withApi, HttpError } from "./http";
import { parseOr400, guardSchema } from "./validate";
import { decide, effectSignals, approveSignals, type Signal } from "./guard";
import type { Classification } from "./classify";
import { _resetRateLimit } from "./ratelimit";

// The /guard route's verdict logic is the shared engine decide() combiner — the
// same one the engine unit-tests cover exhaustively. Here we prove (a) the route
// wiring rejects malformed input with a 400 (never a 500), and (b) the response
// surface comes straight from decide() through the @chainsage/engine shim.

function post(body: unknown, key: string | null = "demo"): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["x-api-key"] = key;
  return new NextRequest("http://localhost/api/v1/guard", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// Mirror the real route's handler body WITHOUT the live RPC gather (guardIntent),
// so the test stays deterministic and offline. The validation + envelope path is
// identical to app/api/v1/guard/route.ts.
const guardValidationHandler = withApi("guard", async ({ body }) => {
  const intent = parseOr400(guardSchema, body);
  return { data: { type: intent.type }, verdict: "ALLOW", address: "0x0" };
});

beforeEach(() => _resetRateLimit());

describe("/guard input validation (route wiring)", () => {
  it("malformed intent → 400, NOT 500", async () => {
    const res = await guardValidationHandler(
      post({ type: "approve", token: "0xnope", spender: "0xnope", amount: "1" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("invalid_input");
  });

  it("missing amount → 400", async () => {
    const addr = "0x" + "1".repeat(40);
    const res = await guardValidationHandler(post({ type: "approve", token: addr, spender: addr }));
    expect(res.status).toBe(400);
  });

  it("unknown intent type → 400", async () => {
    const res = await guardValidationHandler(post({ type: "selfdestruct" }));
    expect(res.status).toBe(400);
  });

  it("valid intent → 200 with the { ok, data } envelope", async () => {
    const addr = "0x" + "1".repeat(40);
    const res = await guardValidationHandler(
      post({ type: "approve", token: addr, spender: addr, amount: "unlimited" })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.type).toBe("approve");
  });

  it("accepts an optional `from` (owner) to enable effect simulation", async () => {
    const addr = "0x" + "1".repeat(40);
    const owner = "0x" + "2".repeat(40);
    const res = await guardValidationHandler(
      post({ type: "approve", token: addr, spender: addr, amount: "1", from: owner })
    );
    expect(res.status).toBe(200);
  });

  it("a malformed `from` → 400 (never reaches the chain)", async () => {
    const addr = "0x" + "1".repeat(40);
    const res = await guardValidationHandler(
      post({ type: "transfer", token: addr, to: addr, amount: "1", from: "0xnope" })
    );
    expect(res.status).toBe(400);
  });
});

describe("/guard response surface (engine decide via shim)", () => {
  const cls = (p: Partial<Classification> = {}): Classification => ({
    verdict: "ALLOW",
    isContract: true,
    ageDays: 30,
    isFresh: false,
    knownGood: null,
    signals: [],
    ...p,
  });

  it("never reports simulated=true when the effect sim did not run", () => {
    const r = decide({ signals: approveSignals(cls(), false), simulated: false, notChecked: ["x"] });
    expect(r.simulated).toBe(false);
    expect(r.verdict).toBe("ALLOW");
  });

  it("an effect honeypot signal forces DENY even over a safe approve", () => {
    const signals: Signal[] = [...effectSignals({ isHoneypot: true }), ...approveSignals(cls(), false)];
    expect(decide({ signals, simulated: true }).verdict).toBe("DENY");
  });

  it("HttpError(400) is constructible for the invalid_amount mapping", () => {
    // The route maps a bad amount thrown by gather to a 400; sanity-check the type.
    const e = new HttpError(400, "invalid_amount", 'amount "x" is not valid');
    expect(e.status).toBe(400);
  });
});
