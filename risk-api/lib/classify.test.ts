import { describe, it, expect } from "vitest";
import { classifySpender, FRESH_THRESHOLD_DAYS } from "./classify";

// classifySpender is pure (facts → verdict). These cases are the contract the
// classify endpoint must satisfy; the async wrapper only feeds it real reads.
describe("classifySpender calibration", () => {
  it("EOA → REVIEW", () => {
    const c = classifySpender({ isContract: false, ageDays: null, knownGoodName: null });
    expect(c.verdict).toBe("REVIEW");
    expect(c.isContract).toBe(false);
    expect(c.isFresh).toBe(false);
    expect(c.signals.join(" ")).toMatch(/EOA/);
  });

  it("known-good contract → ALLOW (even if it would otherwise look fresh)", () => {
    const c = classifySpender({ isContract: true, ageDays: 1, knownGoodName: "Uniswap Permit2" });
    expect(c.verdict).toBe("ALLOW");
    expect(c.knownGood).toBe("Uniswap Permit2");
  });

  it("fresh contract (<7d) → REVIEW", () => {
    const c = classifySpender({ isContract: true, ageDays: 2, knownGoodName: null });
    expect(c.verdict).toBe("REVIEW");
    expect(c.isFresh).toBe(true);
    expect(c.signals.join(" ")).toMatch(/freshly deployed/i);
  });

  it("established contract (≥7d) → ALLOW", () => {
    const c = classifySpender({ isContract: true, ageDays: 30, knownGoodName: null });
    expect(c.verdict).toBe("ALLOW");
    expect(c.isFresh).toBe(false);
  });

  it("age exactly at the threshold is NOT fresh", () => {
    const c = classifySpender({
      isContract: true,
      ageDays: FRESH_THRESHOLD_DAYS,
      knownGoodName: null,
    });
    expect(c.isFresh).toBe(false);
    expect(c.verdict).toBe("ALLOW");
  });

  it("contract with unbounded age (null) is treated as established, not fresh", () => {
    const c = classifySpender({ isContract: true, ageDays: null, knownGoodName: null });
    expect(c.isFresh).toBe(false);
    expect(c.verdict).toBe("ALLOW");
  });
});
