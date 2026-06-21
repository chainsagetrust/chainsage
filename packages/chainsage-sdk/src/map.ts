/**
 * Pure mapping: on-chain facts (Classifications) → intent-safety parts → Verdict.
 *
 * SINGLE SOURCE OF TRUTH: the verdict itself comes from the shared engine's pure
 * combiner `decide()`. Each intent kind builds engine `Signal[]` (via the shared
 * producers approveSignals / transferSignals / swapSignals) and hands them to
 * decide() — the SAME combiner the Risk API `/guard` endpoint calls. There is no
 * second copy of the verdict logic here.
 *
 * The SDK runs no transaction-effect simulation (no honeypot / hidden-transfer /
 * intent-mismatch reads), so it always reports `simulated: false` and lists those
 * effect checks in `notChecked`. It never fabricates a clean simulation.
 */
import {
  approveSignals,
  decide,
  swapSignals,
  transferSignals,
  type Classification,
  type Signal,
} from "@chainsage/engine";
import type { Decision, Intent, Verdict } from "./types";

export interface EvalParts {
  decision: Decision;
  reasons: string[];
  notChecked: string[];
  /** Whether transaction-effect simulation actually ran (always false in the SDK today). */
  simulated: boolean;
  /** Spender/destination is on the known-good allowlist (lifts the ALLOW score to 100). */
  knownGood?: boolean;
  experimental?: boolean;
}

/**
 * Representative intent-safety score. INVARIANT: the returned value always falls
 * in the engine band that maps back to `decision` (≥75 ALLOW, 45–74 REVIEW,
 * <45 DENY), so score and decision can never disagree.
 */
export function decisionToScore(decision: Decision, knownGood = false): number {
  switch (decision) {
    case "ALLOW":
      return knownGood ? 100 : 88;
    case "REVIEW":
      return 60;
    case "DENY":
      return 18;
  }
}

export function makeVerdictId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `vrd_${uuid}`;
  // Fallback for runtimes without Web Crypto.
  return `vrd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const APPROVE_NOT_CHECKED = [
  "Token-contract honesty (fee-on-transfer, blocklists, upgradeable logic) is not checked.",
  "Your current balance and any existing allowance are not read — the intent carries no owner-side reads.",
  "Transaction-effect simulation (honeypot / hidden-transfer / intent-mismatch) is not run by the SDK.",
];
const TRANSFER_NOT_CHECKED = [
  "Sender balance is not checked.",
  "Whether a contract destination can receive/return the token is not simulated.",
  "Transaction-effect simulation (honeypot / hidden-transfer / intent-mismatch) is not run by the SDK.",
];
const SWAP_NOT_CHECKED = [
  "The swap route, price, slippage and output amount are NOT simulated — only the two token contracts are classified on-chain.",
  "A swap intent carries no router/spender, so the route's approval risk is not assessed.",
];
const X402_NOT_CHECKED = [
  "x402 settlement is forward-looking and NOT live — this verdict treats the payment as a plain value transfer to `to`.",
  "Sender balance is not checked.",
];

/** Combine engine signals through the shared decide() combiner (SDK never simulates effects). */
function combine(signals: Signal[], notChecked: string[]): { decision: Decision; reasons: string[] } {
  const r = decide({ signals, simulated: false, notChecked });
  return { decision: r.verdict, reasons: r.reasons };
}

export function approveParts(spender: Classification, isUnlimited: boolean): EvalParts {
  const { decision, reasons } = combine(approveSignals(spender, isUnlimited), APPROVE_NOT_CHECKED);
  return {
    decision,
    reasons: [...reasons, ...spender.signals],
    notChecked: APPROVE_NOT_CHECKED,
    simulated: false,
    knownGood: !!spender.knownGood,
  };
}

export function transferParts(
  destination: Classification,
  toIsZero: boolean,
  toIsTokenContract: boolean
): EvalParts {
  const { decision, reasons } = combine(
    transferSignals({ toIsZero, toIsTokenContract, destination }),
    TRANSFER_NOT_CHECKED
  );
  return {
    decision,
    reasons: [...reasons, ...destination.signals],
    notChecked: TRANSFER_NOT_CHECKED,
    simulated: false,
    knownGood: !!destination.knownGood,
  };
}

export function swapParts(tokenIn: Classification, tokenOut: Classification): EvalParts {
  const { decision, reasons } = combine(swapSignals(tokenIn, tokenOut), SWAP_NOT_CHECKED);
  return {
    decision,
    reasons: [
      ...reasons,
      `tokenIn: ${tokenIn.signals[tokenIn.signals.length - 1] ?? "classified"}`,
      `tokenOut: ${tokenOut.signals[tokenOut.signals.length - 1] ?? "classified"}`,
    ],
    notChecked: SWAP_NOT_CHECKED,
    simulated: false,
  };
}

export function x402Parts(destination: Classification, toIsZero: boolean): EvalParts {
  // x402 is treated as a value transfer to `to` (no token contract context).
  const { decision, reasons } = combine(
    transferSignals({ toIsZero, toIsTokenContract: false, destination }),
    X402_NOT_CHECKED
  );
  return {
    decision,
    reasons: ["x402 micropayment (forward-looking).", ...reasons, ...destination.signals],
    notChecked: X402_NOT_CHECKED,
    simulated: false,
    knownGood: !!destination.knownGood,
    experimental: true,
  };
}

export function buildVerdict(intent: Intent, parts: EvalParts, source: "api" | "local"): Verdict {
  return {
    decision: parts.decision,
    score: decisionToScore(parts.decision, parts.knownGood),
    reasons: parts.reasons,
    verdictId: makeVerdictId(),
    intent,
    notChecked: parts.notChecked,
    simulated: parts.simulated,
    experimental: parts.experimental ?? false,
    source,
    at: new Date().toISOString(),
    failSafe: false,
  };
}

export function buildFailSafe(
  intent: Intent,
  source: "api" | "local",
  onError: Extract<Decision, "REVIEW" | "DENY">,
  err: unknown
): Verdict {
  const detail = err instanceof Error ? err.message : String(err);
  return {
    decision: onError,
    score: decisionToScore(onError),
    reasons: [
      `ChainSage could not obtain a verdict (${detail}). Failing safe to ${onError} — a trust layer never fails open.`,
    ],
    verdictId: makeVerdictId(),
    intent,
    notChecked: ["Everything — the verdict could not be computed; this is a fail-safe decision."],
    simulated: false,
    experimental: intent.kind === "x402_pay",
    source,
    at: new Date().toISOString(),
    failSafe: true,
  };
}
