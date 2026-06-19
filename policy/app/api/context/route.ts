/**
 * /api/context — compute a PolicyContext fact bundle for a counterparty address
 * using Guardian's LIVE Base reads (the shared @chainsage/engine), then return
 * the facts the pure policy engine needs: freshness + a derived trust score.
 *
 * This is the honest "context is supplied by the caller" boundary: the policy
 * engine itself does no I/O — this server route does the reads (RPC stays
 * server-side) and hands the facts to the browser, which then calls evaluate().
 */
import { classifyAddress, type Classification } from "@chainsage/engine";
import { getAddress } from "viem";
import { trustFromClassification } from "@/lib/trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get("address")?.trim() ?? "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return json({ ok: false, error: { message: "Provide a valid 0x address." } }, 400);
  }

  try {
    const address = getAddress(raw);
    const c: Classification = await classifyAddress(address);
    return json({
      ok: true,
      data: {
        address,
        counterpartyIsFresh: c.isFresh,
        counterpartyTrust: trustFromClassification(c),
        verdict: c.verdict,
        isContract: c.isContract,
        ageDays: c.ageDays,
        knownGood: c.knownGood,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read the chain.";
    return json({ ok: false, error: { message } }, 502);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
