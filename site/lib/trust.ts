/**
 * Derive a 0–1 counterparty trust score from the shared engine's Classification.
 *
 * The policy engine's `trustThreshold` rule consumes a 0–1 score, but Guardian's
 * classifier returns a three-state Verdict plus on-chain signals. This is the
 * ONE place that bridges them, kept explicit and honest: it is a heuristic
 * projection of the classifier's verdict, not an independent reputation oracle.
 */
import type { Classification } from "@chainsage/engine";

export function trustFromClassification(c: Classification): number {
  if (c.knownGood) return 1; // curated allowlist hit (e.g. Permit2, Uniswap router)
  if (c.isFresh) return 0.2; // freshly deployed — strongest drainer signal
  switch (c.verdict) {
    case "ALLOW":
      return 0.8; // established contract, no fresh-deploy signal
    case "REVIEW":
      return 0.35; // EOA spender or otherwise unproven
    case "DENY":
      return 0.1;
  }
}
