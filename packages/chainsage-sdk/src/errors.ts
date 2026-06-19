/**
 * Typed errors — the SDK never throws strings.
 */
import type { Verdict } from "./types";

export class ChainSageError extends Error {
  readonly detail?: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "ChainSageError";
    this.detail = detail;
  }
}

/** Thrown by `guard()` when the verdict is DENY. Carries the full verdict. */
export class ChainSageDenied extends ChainSageError {
  readonly verdict: Verdict;
  constructor(verdict: Verdict) {
    super(
      `ChainSage DENIED ${verdict.intent.kind}: ${verdict.reasons[0] ?? "blocked"} [${verdict.verdictId}]`
    );
    this.name = "ChainSageDenied";
    this.verdict = verdict;
  }
}

/** Thrown by `guard()` when the verdict is REVIEW and the review policy blocks. */
export class ChainSageReview extends ChainSageError {
  readonly verdict: Verdict;
  constructor(verdict: Verdict) {
    super(
      `ChainSage flagged ${verdict.intent.kind} for REVIEW: ${verdict.reasons[0] ?? "needs human review"} [${verdict.verdictId}]`
    );
    this.name = "ChainSageReview";
    this.verdict = verdict;
  }
}
