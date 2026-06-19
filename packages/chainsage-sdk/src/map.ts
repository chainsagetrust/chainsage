/**
 * Pure mapping: on-chain facts (Classifications) → intent-safety parts → Verdict.
 *
 * The core risk decisions are the SHARED engine's pure evaluators
 * (evaluateApprove / evaluateTransfer) — no copy here. `swapParts` is the only
 * SDK-original decision (swaps have no engine evaluator) and is deliberately
 * conservative + honest about what it does not check.
 */
import {
  evaluateApprove,
  evaluateTransfer,
  type Classification,
} from "@chainsage/engine";
import type { Decision, Intent, Verdict } from "./types";

export interface EvalParts {
  decision: Decision;
  reasons: string[];
  notChecked: string[];
  /** Spender/destination is on the known-good allowlist (lifts the ALLOW score to 100). */
  knownGood?: boolean;
  experimental?: boolean;
}

const RANK: Record<Decision, number> = { ALLOW: 0, REVIEW: 1, DENY: 2 };

export function worstDecision(a: Decision, b: Decision): Decision {
  return RANK[a] >= RANK[b] ? a : b;
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
];
const TRANSFER_NOT_CHECKED = [
  "Sender balance is not checked.",
  "Whether a contract destination can receive/return the token is not simulated.",
];
const SWAP_NOT_CHECKED = [
  "The swap route, price, slippage and output amount are NOT simulated — only the two token contracts are classified on-chain.",
  "A swap intent carries no router/spender, so the route's approval risk is not assessed.",
];
const X402_NOT_CHECKED = [
  "x402 settlement is forward-looking and NOT live — this verdict treats the payment as a plain value transfer to `to`.",
  "Sender balance is not checked.",
];

export function approveParts(spender: Classification, isUnlimited: boolean): EvalParts {
  const { verdict, reasons } = evaluateApprove(spender, isUnlimited);
  return {
    decision: verdict,
    reasons: [...reasons, ...spender.signals],
    notChecked: APPROVE_NOT_CHECKED,
    knownGood: !!spender.knownGood,
  };
}

export function transferParts(
  destination: Classification,
  toIsZero: boolean,
  toIsTokenContract: boolean
): EvalParts {
  const { verdict, reasons } = evaluateTransfer({ toIsZero, toIsTokenContract, destination });
  return {
    decision: verdict,
    reasons: [...reasons, ...destination.signals],
    notChecked: TRANSFER_NOT_CHECKED,
    knownGood: !!destination.knownGood,
  };
}

export function swapParts(tokenIn: Classification, tokenOut: Classification): EvalParts {
  const decision = worstDecision(tokenIn.verdict, tokenOut.verdict);
  const reasons: string[] = [];
  if (decision === "ALLOW") {
    reasons.push("Both tokens are established on-chain contracts; no fresh-deploy signal.");
  } else {
    reasons.push(
      "At least one side of the swap is an unfamiliar or freshly-deployed token contract — verify before routing."
    );
  }
  reasons.push(`tokenIn: ${tokenIn.signals[tokenIn.signals.length - 1] ?? "classified"}`);
  reasons.push(`tokenOut: ${tokenOut.signals[tokenOut.signals.length - 1] ?? "classified"}`);
  return { decision, reasons, notChecked: SWAP_NOT_CHECKED };
}

export function x402Parts(destination: Classification, toIsZero: boolean): EvalParts {
  // x402 is treated as a value transfer to `to` (no token contract context).
  const { verdict, reasons } = evaluateTransfer({
    toIsZero,
    toIsTokenContract: false,
    destination,
  });
  return {
    decision: verdict,
    reasons: ["x402 micropayment (forward-looking).", ...reasons, ...destination.signals],
    notChecked: X402_NOT_CHECKED,
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
    experimental: intent.kind === "x402_pay",
    source,
    at: new Date().toISOString(),
    failSafe: true,
  };
}
