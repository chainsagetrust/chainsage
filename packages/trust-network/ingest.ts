/**
 * @chainsage/trust-network — signal ingestion (pure mapping).
 *
 * This is the bridge from Phases 1–4 into the network: a `Verdict` produced by
 * Guardian / the SDK / the policy engine becomes a `Signal` about the entity the
 * verdict judged. The actual WRITE path (persisting the signal to a store) lives
 * in the app (Deliverable C) — this module is pure so it stays testable.
 *
 * Honest note: a verdict is a *prediction*. The high-value signal is the observed
 * OUTCOME — did the flagged thing actually drain? When the caller knows the
 * outcome, pass it; that produces a much stronger signal than the verdict alone.
 */
import type { Address, Intent, Verdict } from "chainsage";
import type { Signal } from "./model";

/** The entity a verdict is really "about" — the counterparty the trust concerns. */
export function subjectOf(intent: Intent): Address {
  switch (intent.kind) {
    case "approve":
      return intent.spender;
    case "transfer":
      return intent.to;
    case "swap":
      return intent.tokenOut; // the token you'd end up holding
    case "x402_pay":
      return intent.to;
  }
}

export type ObservedOutcome = "drained" | "safe" | "unknown";

/**
 * Map a verdict (+ optional observed outcome) to a network Signal.
 *
 *  - A confirmed `drained` outcome is an INCIDENT (value -1) — the strongest
 *    negative signal, regardless of what the verdict had predicted.
 *  - A confirmed `safe` outcome is a positive verdict_outcome.
 *  - With no observed outcome we emit a weaker verdict_outcome reflecting only the
 *    prediction: ALLOW leans positive, REVIEW slightly negative, DENY negative.
 *    Its weight is lower because a prediction is weaker evidence than an outcome.
 */
export function verdictToSignal(
  verdict: Verdict,
  observer: Address,
  outcome: ObservedOutcome = "unknown",
  at = 0
): Signal {
  const about = subjectOf(verdict.intent);

  if (outcome === "drained") {
    return { from: observer, about, type: "incident", weight: 5, value: -1, at };
  }
  if (outcome === "safe") {
    return { from: observer, about, type: "verdict_outcome", weight: 2, value: 0.8, at };
  }

  // Prediction only — weaker evidence.
  const value = verdict.decision === "ALLOW" ? 0.5 : verdict.decision === "REVIEW" ? -0.2 : -0.7;
  return { from: observer, about, type: "verdict_outcome", weight: 1, value, at };
}
