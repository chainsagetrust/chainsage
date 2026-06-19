/**
 * chainsage — the trust layer for autonomous finance, as an SDK.
 *
 * Ask for a verdict before your agent signs:
 *   import { ChainSage } from "chainsage";
 *   const cs = new ChainSage();
 *   const verdict = await cs.check(intent);   // ALLOW | REVIEW | DENY
 *   await cs.guard(intent, () => execute());   // runs only on ALLOW
 */

export { ChainSage } from "./client";
export { ChainSageError, ChainSageDenied, ChainSageReview } from "./errors";
export { decisionToScore } from "./map";

export type {
  Address,
  Chain,
  Decision,
  Intent,
  ApproveIntent,
  TransferIntent,
  SwapIntent,
  X402PayIntent,
  Verdict,
  ChainSageConfig,
  GuardOptions,
  ReviewPolicy,
} from "./types";
