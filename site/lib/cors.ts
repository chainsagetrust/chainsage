/**
 * CORS for browser callers. Origins are configurable via RISK_API_CORS_ORIGINS
 * (comma-separated, default "*"). Preflight (OPTIONS) is answered 204.
 */
import { NextRequest, NextResponse } from "next/server";

export function allowedOrigins(): string[] {
  return (process.env.RISK_API_CORS_ORIGINS ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allow.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && allow.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Answer a CORS preflight request. */
export function preflight(req: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
