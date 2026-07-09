import { NextRequest } from "next/server";
import { withApi, HttpError } from "@/lib/http";
import { preflight } from "@/lib/cors";
import { parseOr400, simulateSchema } from "@/lib/validate";
import { simulateIntent } from "@/lib/simulate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export const POST = withApi("simulate", async ({ body }) => {
  const intent = parseOr400(simulateSchema, body);
  let result;
  try {
    result = await simulateIntent(intent);
  } catch (err) {
    // A bad `amount` is the caller's mistake → 400, not a 500.
    if (err instanceof Error && /amount/i.test(err.message)) {
      throw new HttpError(400, "invalid_amount", err.message);
    }
    throw err;
  }
  const addr = intent.type === "approve" ? intent.spender : intent.to;
  return { data: result, verdict: result.verdict, address: addr };
});
