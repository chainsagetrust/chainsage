import { NextRequest, NextResponse } from "next/server";
import { ChainSage, type Intent } from "chainsage";

// Local mode runs the shared verdict engine in-process → needs the Node runtime
// and a Base RPC (BASE_RPC_URL, server-only). Never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cs = new ChainSage({ mode: "local", onError: "REVIEW" });

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;
// A real, un-vetted Base address (not on the known-good allowlist). It is
// classified live — whatever it actually is on-chain drives the verdict.
const UNKNOWN_SPENDER = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;
const AGENT = "0x00000000000000000000000000000000DeaDBeef" as const; // the demo agent wallet

// The real, typed intents (bigints live here, server-side — never sent over JSON).
const INTENTS: Record<string, Intent> = {
  swap: {
    kind: "swap",
    chain: "base",
    tokenIn: USDC,
    tokenOut: WETH,
    amountIn: 500_000000n, // 500 USDC (6 decimals)
    owner: AGENT,
  },
  "transfer-self": {
    kind: "transfer",
    chain: "base",
    token: USDC,
    to: USDC, // sending to the token's own contract — unrecoverable
    amount: 5000_000000n,
    owner: AGENT,
  },
  "approve-unknown": {
    kind: "approve",
    chain: "base",
    token: USDC,
    spender: UNKNOWN_SPENDER,
    amount: "unlimited",
    owner: AGENT,
  },
  x402: {
    kind: "x402_pay",
    chain: "base",
    to: UNKNOWN_SPENDER,
    amount: 250000n, // 0.25 USDC
    owner: AGENT,
  },
};

export async function POST(req: NextRequest) {
  let scenarioId: string | undefined;
  try {
    const body = (await req.json()) as { scenarioId?: string };
    scenarioId = body.scenarioId;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const intent = scenarioId ? INTENTS[scenarioId] : undefined;
  if (!intent) {
    return NextResponse.json({ ok: false, error: "unknown scenario" }, { status: 400 });
  }

  // The real SDK verdict (fail-safe: never ALLOW on error).
  const verdict = await cs.check(intent);

  // Exactly what cs.guard() does with this verdict: ALLOW → execute, REVIEW →
  // hold for human, DENY → block. We surface it as a string for the UI.
  const outcome =
    verdict.decision === "DENY" ? "blocked" : verdict.decision === "REVIEW" ? "held" : "executed";

  // Verdict.intent carries bigints — make the payload JSON-safe.
  const safe = JSON.parse(
    JSON.stringify(verdict, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );

  return NextResponse.json({ ok: true, verdict: safe, outcome });
}
