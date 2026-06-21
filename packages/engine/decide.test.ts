import { describe, it, expect } from "vitest";
import {
  decide,
  worstVerdict,
  effectSignals,
  approveSignals,
  transferSignals,
  swapSignals,
  FAILSAFE_REASON,
  type Signal,
} from "./decide";
import type { Classification } from "./classify";

// --- fixtures -------------------------------------------------------------

function cls(p: Partial<Classification> = {}): Classification {
  return {
    verdict: "ALLOW",
    isContract: true,
    ageDays: 30,
    isFresh: false,
    knownGood: null,
    signals: [],
    ...p,
  };
}
const KNOWN_GOOD = cls({ knownGood: "Uniswap Permit2", ageDays: 400 });
const ESTABLISHED = cls({ ageDays: 30 });
const FRESH = cls({ verdict: "REVIEW", isFresh: true, ageDays: 1 });
const EOA = cls({ verdict: "REVIEW", isContract: false, ageDays: null });

const sig = (severity: Signal["severity"], id = severity.toLowerCase()): Signal => ({
  id,
  severity,
  title: id,
  detail: `${id} signal`,
});

/** Combine producers exactly as the gather layer does: effect signals + intent signals. */
function verdictFor(signals: Signal[], simulated = false) {
  return decide({ signals, simulated }).verdict;
}

// --- the pure combiner: worst-severity precedence -------------------------

describe("decide() — pure combiner", () => {
  it("DENY > REVIEW > ALLOW precedence", () => {
    expect(worstVerdict("ALLOW", "REVIEW")).toBe("REVIEW");
    expect(worstVerdict("REVIEW", "DENY")).toBe("DENY");
    expect(worstVerdict("ALLOW", "DENY")).toBe("DENY");
    expect(decide({ signals: [sig("ALLOW"), sig("REVIEW"), sig("DENY")], simulated: true }).verdict).toBe("DENY");
    expect(decide({ signals: [sig("ALLOW"), sig("REVIEW")], simulated: true }).verdict).toBe("REVIEW");
    expect(decide({ signals: [sig("ALLOW"), sig("ALLOW")], simulated: true }).verdict).toBe("ALLOW");
  });

  it("FAIL-SAFE: zero signals → REVIEW, never ALLOW", () => {
    const r = decide({ signals: [], simulated: false });
    expect(r.verdict).toBe("REVIEW");
    expect(r.reasons[0]).toBe(FAILSAFE_REASON);
  });

  it("FAIL-SAFE: a malformed facts object (no signals array) → REVIEW", () => {
    const r = decide({} as never);
    expect(r.verdict).toBe("REVIEW");
  });

  it("never claims simulated=true unless told so; carries notChecked verbatim", () => {
    const r = decide({ signals: [sig("ALLOW")], simulated: false, notChecked: ["effects not run"] });
    expect(r.simulated).toBe(false);
    expect(r.notChecked).toEqual(["effects not run"]);
  });
});

// --- THE THREAT SCENARIOS (the contract decide() + producers must satisfy) -

describe("threat scenarios", () => {
  it("1. honeypot → DENY", () => {
    expect(verdictFor(effectSignals({ isHoneypot: true }), true)).toBe("DENY");
  });

  it("2. hidden-transfer → DENY", () => {
    expect(verdictFor(effectSignals({ hasHiddenTransfer: true }), true)).toBe("DENY");
  });

  it("3. intent-mismatch → DENY", () => {
    expect(verdictFor(effectSignals({ intentMismatch: true }), true)).toBe("DENY");
  });

  it("4. unlimited + fresh contract → DENY (textbook drainer)", () => {
    const r = decide({ signals: approveSignals(FRESH, true), simulated: false });
    expect(r.verdict).toBe("DENY");
    expect(r.reasons.join(" ")).toMatch(/drainer/i);
  });

  it("5. unlimited to an established (non-allowlisted) protocol → REVIEW", () => {
    expect(verdictFor(approveSignals(ESTABLISHED, true))).toBe("REVIEW");
  });

  it("5b. unlimited to a curated known-good spender (e.g. Permit2) → ALLOW (allowlist exception)", () => {
    // NOTE: the engine's calibration trusts the curated allowlist (Permit2,
    // Uniswap routers) even for unlimited approvals — Permit2 *requires* it.
    // This is the one cell where the engine intentionally says ALLOW, not REVIEW.
    expect(verdictFor(approveSignals(KNOWN_GOOD, true))).toBe("ALLOW");
  });

  it("6. clean approve (limited, established) → ALLOW", () => {
    expect(verdictFor(approveSignals(ESTABLISHED, false))).toBe("ALLOW");
  });

  it("7. approve fresh + limited → REVIEW", () => {
    expect(verdictFor(approveSignals(FRESH, false))).toBe("REVIEW");
  });

  it("8. approve to an EOA spender → REVIEW", () => {
    expect(verdictFor(approveSignals(EOA, false))).toBe("REVIEW");
    expect(verdictFor(approveSignals(EOA, true))).toBe("REVIEW");
  });

  it("9. transfer to the zero address → DENY (burn)", () => {
    const r = decide({
      signals: transferSignals({ toIsZero: true, toIsTokenContract: false, destination: ESTABLISHED }),
      simulated: false,
    });
    expect(r.verdict).toBe("DENY");
    expect(r.reasons.join(" ")).toMatch(/burn/i);
  });

  it("10. transfer to the token's own contract → DENY", () => {
    expect(
      verdictFor(transferSignals({ toIsZero: false, toIsTokenContract: true, destination: ESTABLISHED }))
    ).toBe("DENY");
  });

  it("11. transfer to a fresh contract → REVIEW", () => {
    expect(
      verdictFor(transferSignals({ toIsZero: false, toIsTokenContract: false, destination: FRESH }))
    ).toBe("REVIEW");
  });

  it("12. transfer to a normal EOA → ALLOW", () => {
    expect(
      verdictFor(transferSignals({ toIsZero: false, toIsTokenContract: false, destination: EOA }))
    ).toBe("ALLOW");
  });

  it("13. swap between two established tokens → ALLOW", () => {
    expect(verdictFor(swapSignals(ESTABLISHED, ESTABLISHED))).toBe("ALLOW");
  });

  it("14. swap where one side is fresh/unfamiliar → REVIEW", () => {
    expect(verdictFor(swapSignals(ESTABLISHED, FRESH))).toBe("REVIEW");
  });

  it("15. an effect-level DENY overrides an otherwise-ALLOW approve", () => {
    // Approve to a known-good spender would be ALLOW, but a simulated honeypot
    // is lethal and must win. This is why effect signals merge with approval signals.
    const signals = [...effectSignals({ isHoneypot: true }), ...approveSignals(KNOWN_GOOD, false)];
    expect(verdictFor(signals, true)).toBe("DENY");
  });
});
