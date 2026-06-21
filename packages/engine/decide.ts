/**
 * decide — the canonical ChainSage verdict COMBINER.
 *
 * This is the single source of truth for "given the risk signals gathered for a
 * proposed action, what is the verdict?". The Risk API (`/api/v1/guard`) and the
 * Agent SDK (`chainsage.check`/`guard`) both import and call `decide()` — there
 * is no second copy of this logic anywhere.
 *
 * THE PURE/IMPURE SPLIT (deliberate, and the reason this file is exhaustively
 * tested):
 *   - signal-GATHERING (simulation, contract-age reads, allowance reads,
 *     known-bad cross-checks) lives in guard.ts / chain.ts / classify.ts and
 *     does I/O against Base. It produces `Signal[]`.
 *   - signal-COMBINING is `decide()` — PURE and deterministic: signals in,
 *     verdict out. No network, no clock, no randomness. That is what the threat
 *     scenarios test.
 *
 * The signal PRODUCERS below (approveSignals / transferSignals / swapSignals /
 * effectSignals) translate facts into signals. The approval/transfer producers
 * REUSE the already-calibrated, already-tested evaluators in simulate.ts — they
 * do not re-encode the calibration, so there is no way for it to drift.
 *
 * FAIL-SAFE: if NO signals could be gathered, decide() returns REVIEW, never
 * ALLOW. A trust layer that fails open is worse than none.
 *
 * DEFENSIVE ONLY: this path reads and judges. It never signs, holds keys, or
 * authors a transaction.
 */
import type { Verdict } from "./verdict";
import type { Classification } from "./classify";
import { evaluateApprove, evaluateTransfer, type TransferFacts } from "./simulate";

/** A single risk observation contributing one verdict-severity to the merge. */
export interface Signal {
  /** Stable id (e.g. "honeypot", "approve", "transfer"). */
  id: string;
  /** This signal's contribution: ALLOW (no risk) / REVIEW (caution) / DENY (block). */
  severity: Verdict;
  title: string;
  detail: string;
}

/** The full set of gathered signals for one proposed action, plus honesty meta. */
export interface GuardianFacts {
  signals: Signal[];
  /** True ONLY if transaction-effect simulation actually executed. */
  simulated: boolean;
  /** Effect-level checks that could NOT be run (surfaced verbatim — no fabrication). */
  notChecked?: string[];
}

export interface GuardianVerdict {
  verdict: Verdict;
  reasons: string[];
  signals: Signal[];
  simulated: boolean;
  notChecked: string[];
}

const RANK: Record<Verdict, number> = { ALLOW: 0, REVIEW: 1, DENY: 2 };

/** Return the worse (more severe) of two verdicts. DENY > REVIEW > ALLOW. */
export function worstVerdict(a: Verdict, b: Verdict): Verdict {
  return RANK[a] >= RANK[b] ? a : b;
}

export const FAILSAFE_REASON =
  "No risk signals could be gathered for this action — failing safe to REVIEW. A trust layer never fails open.";

/**
 * PURE combiner: signals → verdict. The verdict is the worst severity among all
 * signals (DENY > REVIEW > ALLOW). With zero signals we have judged nothing, so
 * we fail safe to REVIEW — we never default to ALLOW.
 */
export function decide(facts: GuardianFacts): GuardianVerdict {
  const signals = Array.isArray(facts?.signals) ? facts.signals : [];
  const simulated = !!facts?.simulated;
  const notChecked = facts?.notChecked ?? [];

  if (signals.length === 0) {
    return { verdict: "REVIEW", reasons: [FAILSAFE_REASON], signals: [], simulated, notChecked };
  }

  let verdict: Verdict = "ALLOW";
  for (const s of signals) verdict = worstVerdict(verdict, s.severity);

  return { verdict, reasons: signals.map((s) => s.detail), signals, simulated, notChecked };
}

// --- signal producers (facts → signals) -----------------------------------
// These are pure too: each turns already-gathered facts into Signal[]. They are
// the ONLY place the raw evaluators are wrapped, so calibration stays single-source.

/**
 * Transaction-EFFECT signals — the simulation layer. These are the lethal,
 * effect-level findings that only a transaction simulation can surface. The
 * COMBINER handling here is real and tested; the actual on-chain GATHERING of
 * these (debug_traceCall / fork) is not yet implemented (see guard.ts), so today
 * these signals are only produced when an upstream simulator supplies the facts.
 */
export interface EffectFacts {
  /** Token can be bought but not sold (a sell simulation reverts). */
  isHoneypot?: boolean;
  /** Calldata moves value / grants approvals BEYOND the stated intent. */
  hasHiddenTransfer?: boolean;
  /** The simulated net effect contradicts the declared intent. */
  intentMismatch?: boolean;
}

export function effectSignals(e: EffectFacts): Signal[] {
  const out: Signal[] = [];
  if (e.isHoneypot) {
    out.push({
      id: "honeypot",
      severity: "DENY",
      title: "Honeypot token",
      detail:
        "Simulation shows this token can be acquired but not sold — the sell path reverts. This is a honeypot. Do not sign.",
    });
  }
  if (e.hasHiddenTransfer) {
    out.push({
      id: "hidden-transfer",
      severity: "DENY",
      title: "Hidden transfer in calldata",
      detail:
        "The transaction moves value or grants approvals beyond what the stated intent declares. Do not sign.",
    });
  }
  if (e.intentMismatch) {
    out.push({
      id: "intent-mismatch",
      severity: "DENY",
      title: "Intent mismatch",
      detail:
        "The simulated net effect of this transaction contradicts the declared intent. Do not sign.",
    });
  }
  return out;
}

const APPROVE_TITLE: Record<Verdict, string> = {
  ALLOW: "Approval looks safe",
  REVIEW: "Approval needs review",
  DENY: "Dangerous approval",
};
const TRANSFER_TITLE: Record<Verdict, string> = {
  ALLOW: "Transfer looks safe",
  REVIEW: "Transfer needs review",
  DENY: "Dangerous transfer",
};

/** approve signal — REUSES evaluateApprove (single source for approval calibration). */
export function approveSignals(spender: Classification, isUnlimited: boolean): Signal[] {
  const { verdict, reasons } = evaluateApprove(spender, isUnlimited);
  return [{ id: "approve", severity: verdict, title: APPROVE_TITLE[verdict], detail: reasons.join(" ") }];
}

/** transfer signal — REUSES evaluateTransfer (single source for transfer calibration). */
export function transferSignals(facts: TransferFacts): Signal[] {
  const { verdict, reasons } = evaluateTransfer(facts);
  return [{ id: "transfer", severity: verdict, title: TRANSFER_TITLE[verdict], detail: reasons.join(" ") }];
}

/**
 * swap signal — a swap carries no router/spender, so the only on-chain check is
 * classifying the two token contracts. The verdict is the worse of the two
 * classifications (a fresh/unfamiliar side floors it at REVIEW). Deliberately
 * conservative and honest about what it does not check (route/price/slippage).
 */
export function swapSignals(tokenIn: Classification, tokenOut: Classification): Signal[] {
  const severity = worstVerdict(tokenIn.verdict, tokenOut.verdict);
  const detail =
    severity === "ALLOW"
      ? "Both tokens are established on-chain contracts; no fresh-deploy signal on either side."
      : "At least one side of the swap is an unfamiliar or freshly-deployed token contract — verify before routing.";
  return [{ id: "swap", severity, title: severity === "ALLOW" ? "Swap looks safe" : "Swap needs review", detail }];
}
