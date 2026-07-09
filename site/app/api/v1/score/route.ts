import { NextRequest } from "next/server";
import { withApi } from "@/lib/http";
import { preflight } from "@/lib/cors";
import { parseOr400, scoreSchema } from "@/lib/validate";
import { scoreAddress } from "@/lib/score";

// viem getLogs / archival getCode want the Node runtime; never static.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export const POST = withApi("score", async ({ body }) => {
  const { address } = parseOr400(scoreSchema, body);
  const result = await scoreAddress(address);
  return { data: result, verdict: result.report.verdict, address };
});
