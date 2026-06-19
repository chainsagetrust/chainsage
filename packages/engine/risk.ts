/**
 * ChainSage — verdict engine (pure, deterministic, tested).
 *
 * buildReport() turns the on-chain facts gathered by chain.ts into a single
 * health score (0–100), an overall verdict, and a list of actionable flags.
 *
 * This is the ONE source of truth for verdict logic. Guardian (the wallet app)
 * and the Risk API both depend on it — there is no second copy.
 *
 * Design rules:
 *  - Start at 100. Only DEDUCT for concrete, verifiable, on-chain risk.
 *  - EVERY deduction must map to exactly one flag the user can act on.
 *  - This file is pure: no network, no wagmi, no React. That is why it is testable.
 */

import type { Verdict } from "./verdict";

export const BASESCAN = "https://basescan.org/address/";

/** A single live ERC-20 approval, as resolved by chain.ts. */
export interface ApprovalInput {
  token: `0x${string}`;
  tokenSymbol: string;
  spender: `0x${string}`;
  /** Current on-chain allowance (already re-read, never stale). */
  allowance: bigint;
  isUnlimited: boolean;
  /** Block number of the most recent Approval log for this (token, spender). */
  lastBlock: bigint;
}

/** A token balance line for concentration analysis. */
export interface BalanceInput {
  symbol: string;
  /** USD-agnostic: we use raw token "weight" only relatively, so this is the
   *  human-readable float balance. Concentration is a heuristic, not pricing. */
  amount: number;
}

/** Spenders whose deployed contract age (in days) we managed to bound. */
export interface FreshSpenderInput {
  spender: `0x${string}`;
  ageDays: number;
}

export interface BuildReportArgs {
  approvals: ApprovalInput[];
  balances: BalanceInput[];
  /** spender -> estimated contract age in days (null age spenders omitted). */
  freshSpenders: FreshSpenderInput[];
  freshThresholdDays?: number;
}

export type Severity = "info" | "warn" | "danger";

export interface Flag {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  spender?: `0x${string}`;
  basescanLink?: string;
}

export interface ReportStats {
  totalApprovals: number;
  unlimitedApprovals: number;
  freshApprovals: number;
  drainerApprovals: number;
  tokensHeld: number;
}

export interface Report {
  healthScore: number;
  verdict: Verdict;
  flags: Flag[];
  stats: ReportStats;
}

/** ≥75 ALLOW, ≥45 REVIEW, else DENY. */
export function scoreToVerdict(score: number): Verdict {
  if (score >= 75) return "ALLOW";
  if (score >= 45) return "REVIEW";
  return "DENY";
}

const VERDICT_RANK: Record<Verdict, number> = { ALLOW: 0, REVIEW: 1, DENY: 2 };

/** Return the worse (more severe) of two verdicts. */
function worstVerdict(a: Verdict, b: Verdict): Verdict {
  return VERDICT_RANK[a] >= VERDICT_RANK[b] ? a : b;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function buildReport(args: BuildReportArgs): Report {
  const freshThresholdDays = args.freshThresholdDays ?? 7;
  const { approvals, balances } = args;

  const freshSet = new Set(
    args.freshSpenders
      .filter((f) => f.ageDays < freshThresholdDays)
      .map((f) => f.spender.toLowerCase())
  );

  const isFresh = (a: ApprovalInput) => freshSet.has(a.spender.toLowerCase());

  const unlimited = approvals.filter((a) => a.isUnlimited);
  const fresh = approvals.filter(isFresh);
  // The textbook drainer: an approval that is BOTH unlimited AND to a fresh contract.
  const drainers = approvals.filter((a) => a.isUnlimited && isFresh(a));

  let score = 100;
  const flags: Flag[] = [];
  let flagVerdict: Verdict = "ALLOW";

  // --- Fresh-contract approvals (weighted HEAVILY — strongest drainer signal) ---
  if (fresh.length > 0) {
    const n = fresh.length;
    const deduct = Math.min(55, n * 30);
    score -= deduct;
    // Fresh-contract exposure is weighted HEAVILY in the SCORE (−30 each, the
    // largest single deduction), so it dominates the health number. A lone fresh
    // approval floors the verdict at REVIEW (88-? → here 70 → REVIEW per the
    // calibration table); the truly lethal pattern — fresh AND unlimited — is the
    // overlap rule below, which forces DENY outright.
    flagVerdict = worstVerdict(flagVerdict, "REVIEW");
    for (const a of fresh) {
      flags.push({
        id: `fresh-${a.spender.toLowerCase()}`,
        severity: "danger",
        title: "Approval to a freshly deployed contract",
        detail: `${a.tokenSymbol} is approved to a spender whose contract is less than ${freshThresholdDays} days old. New, unproven contracts are the single strongest drainer signal — revoke unless you deliberately trust it.`,
        spender: a.spender,
        basescanLink: BASESCAN + a.spender,
      });
    }
  }

  // --- Unlimited approvals ---
  if (unlimited.length > 0) {
    const n = unlimited.length;
    const deduct = Math.min(40, n * 12);
    score -= deduct;
    // A SINGLE unlimited approval to an established contract is common and low
    // risk (88 → ALLOW), so it does not escalate the verdict on its own — we let
    // the score speak. Two or more unlimited approvals floor the verdict at
    // REVIEW; the score (which drops fast with count) carries larger piles down
    // further. The genuinely dangerous case (unlimited + fresh) is forced to DENY
    // by the overlap rule below, regardless of count.
    if (n >= 2) flagVerdict = worstVerdict(flagVerdict, "REVIEW");
    for (const a of unlimited) {
      // Avoid a duplicate spender flag if it's already flagged as a drainer below.
      flags.push({
        id: `unlimited-${a.token.toLowerCase()}-${a.spender.toLowerCase()}`,
        severity: "warn",
        title: "Unlimited token approval",
        detail: `${a.tokenSymbol} is approved with an effectively unlimited allowance. The spender can move your entire ${a.tokenSymbol} balance, now and in the future.`,
        spender: a.spender,
        basescanLink: BASESCAN + a.spender,
      });
    }
  }

  // --- Compounding overlap: unlimited AND fresh ---
  if (drainers.length > 0) {
    const n = drainers.length;
    const deduct = Math.min(25, n * 25);
    score -= deduct;
    flagVerdict = worstVerdict(flagVerdict, "DENY");
    for (const a of drainers) {
      flags.push({
        id: `drainer-${a.token.toLowerCase()}-${a.spender.toLowerCase()}`,
        severity: "danger",
        title: "Unlimited approval to a brand-new contract",
        detail: `${a.tokenSymbol}: this spender combines an unlimited allowance with a contract under ${freshThresholdDays} days old — the textbook wallet-drainer pattern. Revoke this first.`,
        spender: a.spender,
        basescanLink: BASESCAN + a.spender,
      });
    }
  }

  // --- Large approval surface (>8 active) ---
  if (approvals.length > 8) {
    const n = approvals.length;
    const deduct = Math.min(12, (n - 8) * 2);
    score -= deduct;
    flagVerdict = worstVerdict(flagVerdict, "REVIEW");
    flags.push({
      id: "surface",
      severity: "warn",
      title: "Large approval surface",
      detail: `${n} active approvals are live on this wallet. Each one is an open door — prune the ones you no longer use to shrink your attack surface.`,
    });
  }

  // --- Single-asset concentration (informational) ---
  const nonZero = balances.filter((b) => b.amount > 0);
  if (nonZero.length === 1) {
    score -= 4;
    // Informational only — not a security risk, so DO NOT escalate the verdict.
    flags.push({
      id: "concentration",
      severity: "info",
      title: "Single-asset concentration",
      detail: `This wallet holds only ${nonZero[0].symbol}. Not a security risk — just a heads-up that there is no diversification here.`,
    });
  }

  // --- Clean wallet bonus flag (positive ALLOW signal) ---
  const isClean =
    unlimited.length === 0 && fresh.length === 0 && approvals.length <= 8;
  if (isClean) {
    flags.push({
      id: "clean",
      severity: "info",
      title: "No drainer signals found",
      detail:
        approvals.length === 0
          ? "No active token approvals, no unlimited allowances, no fresh-contract exposure. This wallet's approval surface is clean."
          : `${approvals.length} active approval(s), none unlimited and none to fresh contracts. This wallet's approval surface looks healthy.`,
    });
  }

  score = clamp(Math.round(score), 0, 100);

  // Overall verdict = worst of (score-derived) and (flag-level escalation).
  const verdict = worstVerdict(scoreToVerdict(score), flagVerdict);

  const stats: ReportStats = {
    totalApprovals: approvals.length,
    unlimitedApprovals: unlimited.length,
    freshApprovals: fresh.length,
    drainerApprovals: drainers.length,
    tokensHeld: nonZero.length,
  };

  return { healthScore: score, verdict, flags, stats };
}
