/**
 * Public types for the ChainSage Agent SDK.
 *
 * An agent describes what it *wants to do* as an `Intent`; `cs.check(intent)`
 * returns a `Verdict` — ALLOW / REVIEW / DENY — before anything is signed.
 */

export type Address = `0x${string}`;

/** The sacred three-state decision (identical to the engine's Verdict). */
export type Decision = "ALLOW" | "REVIEW" | "DENY";

/** Only Base is live today. The field is explicit so intents are self-describing. */
export type Chain = "base";

export interface ApproveIntent {
  kind: "approve";
  chain: Chain;
  token: Address;
  spender: Address;
  amount: bigint | "unlimited";
  owner: Address;
}

export interface TransferIntent {
  kind: "transfer";
  chain: Chain;
  token: Address;
  to: Address;
  amount: bigint;
  owner: Address;
}

export interface SwapIntent {
  kind: "swap";
  chain: Chain;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  owner: Address;
}

/**
 * x402 micropayment — FORWARD-LOOKING. x402 settlement is not live; the SDK
 * treats this as a value transfer to `to` for verdict purposes and flags the
 * resulting verdict `experimental: true`. Do not read it as production x402 support.
 */
export interface X402PayIntent {
  kind: "x402_pay";
  chain: Chain;
  to: Address;
  amount: bigint;
  owner: Address;
}

export type Intent = ApproveIntent | TransferIntent | SwapIntent | X402PayIntent;

export interface Verdict {
  /** ALLOW / REVIEW / DENY. */
  decision: Decision;
  /**
   * Intent-safety score 0–100. ALWAYS falls within the band that maps to
   * `decision` (≥75 ALLOW, 45–74 REVIEW, <45 DENY) so score and decision can
   * never contradict. For granular wallet-level health, use the Risk API /score.
   */
  score: number;
  /** Human-readable reasons; each maps to a real check. */
  reasons: string[];
  /** Stable, unique id for this decision — for audit logs. */
  verdictId: string;
  /** The exact intent this verdict judged (echoed for auditability). */
  intent: Intent;
  /** Things this verdict did NOT verify. No fabricated checks. */
  notChecked: string[];
  /**
   * True only if transaction-effect simulation actually ran. The SDK does not
   * simulate effects (honeypot / hidden-transfer / intent-mismatch), so this is
   * always false today — those checks appear in `notChecked`. Never fabricated.
   */
  simulated: boolean;
  /** True for forward-looking intent kinds (e.g. x402_pay) that are not yet live. */
  experimental: boolean;
  /** Where the verdict was computed. */
  source: "api" | "local";
  /** ISO timestamp. */
  at: string;
  /** True when this is a fail-safe verdict produced because a check could not complete. */
  failSafe: boolean;
}

export interface ChainSageConfig {
  /**
   * "local" (default) runs the shared verdict engine in-process — no network
   * hop, but requires the engine + an RPC. "api" calls the hosted Risk API.
   */
  mode?: "api" | "local";
  /** Risk API base URL (api mode). Defaults to CHAINSAGE_API_URL env or localhost:3001. */
  apiUrl?: string;
  /** API key (api mode). Defaults to CHAINSAGE_API_KEY env or "demo". */
  apiKey?: string;
  /** Per-check timeout in ms. Default 8000. A timeout fails SAFE (never ALLOW). */
  timeoutMs?: number;
  /**
   * Where to land when a verdict cannot be computed (network error, timeout,
   * read failure). NEVER "ALLOW". Default "REVIEW" (escalate to a human); set
   * "DENY" for hard fail-closed semantics.
   */
  onError?: Extract<Decision, "REVIEW" | "DENY">;
  /** Injectable fetch (api mode) — for testing/runtimes without a global fetch. */
  fetchImpl?: typeof fetch;
}

export type ReviewPolicy =
  | "deny" // treat REVIEW as a block (throw ChainSageReview) — default, safest
  | "allow" // proceed despite REVIEW (use sparingly)
  | ((verdict: Verdict) => boolean | Promise<boolean>); // ask a human/approver

export interface GuardOptions {
  onReview?: ReviewPolicy;
}
