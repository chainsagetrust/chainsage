import { describe, it, expect } from "vitest";
import { UNLIMITED_THRESHOLD } from "@chainsage/engine";
import { evaluateApprove, evaluateTransfer, isUnlimitedAmount } from "./simulate";
import type { Classification } from "./classify";

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

describe("evaluateApprove calibration", () => {
  it("fresh + unlimited → DENY (textbook drainer, matches Guardian)", () => {
    const r = evaluateApprove(cls({ isFresh: true, ageDays: 1 }), true);
    expect(r.verdict).toBe("DENY");
    expect(r.reasons.join(" ")).toMatch(/drainer/i);
  });

  it("fresh + limited → REVIEW", () => {
    expect(evaluateApprove(cls({ isFresh: true, ageDays: 1 }), false).verdict).toBe("REVIEW");
  });

  it("EOA spender (any amount) → REVIEW", () => {
    expect(evaluateApprove(cls({ isContract: false, ageDays: null }), false).verdict).toBe("REVIEW");
    expect(evaluateApprove(cls({ isContract: false, ageDays: null }), true).verdict).toBe("REVIEW");
  });

  it("known-good + unlimited → ALLOW", () => {
    expect(evaluateApprove(cls({ knownGood: "Uniswap Permit2" }), true).verdict).toBe("ALLOW");
  });

  it("established + unlimited → REVIEW (standing risk worth a look)", () => {
    expect(evaluateApprove(cls(), true).verdict).toBe("REVIEW");
  });

  it("established + limited → ALLOW", () => {
    expect(evaluateApprove(cls(), false).verdict).toBe("ALLOW");
  });
});

describe("evaluateTransfer calibration", () => {
  it("zero address → DENY", () => {
    const r = evaluateTransfer({ toIsZero: true, toIsTokenContract: false, destination: cls() });
    expect(r.verdict).toBe("DENY");
    expect(r.reasons.join(" ")).toMatch(/burn/i);
  });

  it("token's own contract → DENY", () => {
    const r = evaluateTransfer({ toIsZero: false, toIsTokenContract: true, destination: cls() });
    expect(r.verdict).toBe("DENY");
  });

  it("fresh contract destination → REVIEW", () => {
    const r = evaluateTransfer({
      toIsZero: false,
      toIsTokenContract: false,
      destination: cls({ isFresh: true, ageDays: 1 }),
    });
    expect(r.verdict).toBe("REVIEW");
  });

  it("normal EOA destination → ALLOW", () => {
    const r = evaluateTransfer({
      toIsZero: false,
      toIsTokenContract: false,
      destination: cls({ isContract: false, ageDays: null }),
    });
    expect(r.verdict).toBe("ALLOW");
  });
});

describe("isUnlimitedAmount", () => {
  it("literals are unlimited", () => {
    expect(isUnlimitedAmount("unlimited", 6)).toBe(true);
    expect(isUnlimitedAmount("MAX", 18)).toBe(true);
    expect(isUnlimitedAmount("infinite", 18)).toBe(true);
  });

  it("a normal token amount is limited", () => {
    expect(isUnlimitedAmount("100.5", 6)).toBe(false);
    expect(isUnlimitedAmount("0", 18)).toBe(false);
  });

  it("at/above the unlimited threshold is unlimited (raw units, decimals=0)", () => {
    expect(isUnlimitedAmount(UNLIMITED_THRESHOLD.toString(), 0)).toBe(true);
  });

  it("just below the threshold is limited", () => {
    expect(isUnlimitedAmount((UNLIMITED_THRESHOLD - 1n).toString(), 0)).toBe(false);
  });

  it("a non-numeric amount throws (caller maps to 400)", () => {
    expect(() => isUnlimitedAmount("not-a-number", 6)).toThrow(/amount/i);
  });
});
