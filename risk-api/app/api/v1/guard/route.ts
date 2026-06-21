import { NextRequest } from "next/server";
import { withApi, HttpError } from "@/lib/http";
import { preflight } from "@/lib/cors";
import { parseOr400, guardSchema } from "@/lib/validate";
import { guardIntent } from "@/lib/guard";

// viem reads (getCode / archival probes) want the Node runtime; never static.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

/**
 * POST /api/v1/guard — the Guardian verdict.
 *
 * Accepts an `approve` | `transfer` intent, gathers signals server-side (live
 * Base reads via the server RPC), runs the shared decide() combiner, and returns
 * { verdict, reasons[], simulated, verdictId } plus the signals and an honest
 * `notChecked` list. Server-side RPC only (BASE_RPC_URL) — no keys to the client.
 */
export const POST = withApi("guard", async ({ body }) => {
  const intent = parseOr400(guardSchema, body);
  let result;
  try {
    result = await guardIntent(intent);
  } catch (err) {
    // A bad `amount` is the caller's mistake → 400, not a 500.
    if (err instanceof Error && /amount/i.test(err.message)) {
      throw new HttpError(400, "invalid_amount", err.message);
    }
    throw err;
  }
  const addr = intent.type === "approve" ? intent.spender : intent.to;
  return {
    data: {
      verdict: result.verdict,
      reasons: result.reasons,
      simulated: result.simulated,
      // Which effect-simulation provider ran (tenderly | rpc-trace | rpc-call | none),
      // and whether the simulated tx reverts — surfaced honestly for the caller.
      simProvider: result.simProvider,
      reverted: result.reverted,
      verdictId: result.verdictId,
      signals: result.signals,
      notChecked: result.notChecked,
      spenderClassification: result.spenderClassification,
      destinationClassification: result.destinationClassification,
    },
    verdict: result.verdict,
    address: addr,
  };
});
