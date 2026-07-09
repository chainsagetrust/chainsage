import { NextRequest } from "next/server";
import { withApi } from "@/lib/http";
import { preflight } from "@/lib/cors";
import { parseOr400, classifySchema } from "@/lib/validate";
import { classifyAddress } from "@/lib/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export const POST = withApi("classify", async ({ body }) => {
  const { address } = parseOr400(classifySchema, body);
  const classification = await classifyAddress(address);
  return { data: classification, verdict: classification.verdict, address };
});
