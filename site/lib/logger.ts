/**
 * Structured request logging — one JSON line per request.
 *
 * We log only { endpoint, verdict, latencyMs, status } plus the queried address.
 * The address is public on-chain data, not PII in the personal sense; nothing
 * else about the caller is recorded here.
 */

export interface LogEntry {
  endpoint: string;
  status: number;
  latencyMs: number;
  verdict?: string;
  /** The queried address — public on-chain identifier, safe to log. */
  address?: string;
  keyKind?: "demo" | "key";
}

export function logRequest(entry: LogEntry): void {
  const line = {
    t: new Date().toISOString(),
    level: entry.status >= 500 ? "error" : "info",
    svc: "risk-api",
    ...entry,
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line));
}
