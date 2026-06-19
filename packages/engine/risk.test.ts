import { describe, it, expect } from "vitest";
import {
  buildReport,
  scoreToVerdict,
  type ApprovalInput,
  type BalanceInput,
  type FreshSpenderInput,
} from "./risk";

const MAX_UINT256 = (1n << 256n) - 1n;

// --- builders -------------------------------------------------------------

let nonce = 1;
function addr(seed?: number): `0x${string}` {
  const n = (seed ?? nonce++).toString(16).padStart(40, "0");
  return (`0x${n}`) as `0x${string}`;
}

function approval(opts: Partial<ApprovalInput> & { spender?: `0x${string}` } = {}): ApprovalInput {
  const spender = opts.spender ?? addr();
  return {
    token: opts.token ?? addr(),
    tokenSymbol: opts.tokenSymbol ?? "USDC",
    spender,
    allowance: opts.allowance ?? 1_000_000n,
    isUnlimited: opts.isUnlimited ?? false,
    lastBlock: opts.lastBlock ?? 1000n,
  };
}

function unlimitedApproval(spender?: `0x${string}`): ApprovalInput {
  return approval({ spender, allowance: MAX_UINT256, isUnlimited: true });
}

const balances: BalanceInput[] = [
  { symbol: "ETH", amount: 1.2 },
  { symbol: "USDC", amount: 500 },
];

function fresh(spender: `0x${string}`, ageDays = 1): FreshSpenderInput {
  return { spender, ageDays };
}

// --- scoreToVerdict thresholds -------------------------------------------

describe("scoreToVerdict", () => {
  it("maps thresholds correctly", () => {
    expect(scoreToVerdict(100)).toBe("ALLOW");
    expect(scoreToVerdict(75)).toBe("ALLOW");
    expect(scoreToVerdict(74)).toBe("REVIEW");
    expect(scoreToVerdict(45)).toBe("REVIEW");
    expect(scoreToVerdict(44)).toBe("DENY");
    expect(scoreToVerdict(0)).toBe("DENY");
  });
});

// --- the calibration table (the contract this engine must satisfy) --------

describe("buildReport calibration table", () => {
  it("clean wallet → 100 → ALLOW", () => {
    const r = buildReport({ approvals: [], balances, freshSpenders: [] });
    expect(r.healthScore).toBe(100);
    expect(r.verdict).toBe("ALLOW");
    expect(r.flags.some((f) => f.id === "clean")).toBe(true);
  });

  it("1 unlimited (established) → ~88 → ALLOW", () => {
    const r = buildReport({
      approvals: [unlimitedApproval()],
      balances,
      freshSpenders: [],
    });
    expect(r.healthScore).toBe(88);
    expect(r.verdict).toBe("ALLOW");
  });

  it("3 unlimited (established) → ~64 → REVIEW", () => {
    const r = buildReport({
      approvals: [unlimitedApproval(), unlimitedApproval(), unlimitedApproval()],
      balances,
      freshSpenders: [],
    });
    expect(r.healthScore).toBe(64);
    expect(r.verdict).toBe("REVIEW");
  });

  it("1 fresh-contract approval → ~70 → REVIEW", () => {
    const spender = addr();
    const r = buildReport({
      approvals: [approval({ spender })],
      balances,
      freshSpenders: [fresh(spender, 2)],
    });
    expect(r.healthScore).toBe(70);
    expect(r.verdict).toBe("REVIEW");
  });

  it("unlimited + fresh (drainer) → ~29 → DENY", () => {
    const spender = addr();
    const r = buildReport({
      approvals: [unlimitedApproval(spender)],
      balances,
      freshSpenders: [fresh(spender, 1)],
    });
    // Heavy overlap penalty lands this firmly in DENY. (Target ~29; the engine's
    // exact value is allowed to drift within the DENY band so long as it stays
    // there — the verdict is the contract, the number is calibration.)
    expect(r.verdict).toBe("DENY");
    expect(r.healthScore).toBeLessThanOrEqual(35);
    expect(r.healthScore).toBeGreaterThanOrEqual(20);
    expect(r.stats.drainerApprovals).toBe(1);
  });
});

// --- additional invariants ------------------------------------------------

describe("buildReport invariants", () => {
  it("every deduction surfaces an actionable flag", () => {
    const spender = addr();
    const r = buildReport({
      approvals: [unlimitedApproval(spender)],
      balances,
      freshSpenders: [fresh(spender, 1)],
    });
    // unlimited + fresh + drainer overlap all produced flags
    expect(r.flags.some((f) => f.id.startsWith("unlimited-"))).toBe(true);
    expect(r.flags.some((f) => f.id.startsWith("fresh-"))).toBe(true);
    expect(r.flags.some((f) => f.id.startsWith("drainer-"))).toBe(true);
  });

  it("clamps score to [0,100]", () => {
    const approvals: ApprovalInput[] = [];
    const freshSpenders: FreshSpenderInput[] = [];
    for (let i = 0; i < 12; i++) {
      const s = addr();
      approvals.push(unlimitedApproval(s));
      freshSpenders.push(fresh(s, 1));
    }
    const r = buildReport({ approvals, balances, freshSpenders });
    expect(r.healthScore).toBeGreaterThanOrEqual(0);
    expect(r.healthScore).toBeLessThanOrEqual(100);
    expect(r.verdict).toBe("DENY");
  });

  it("large approval surface (>8) deducts and flags REVIEW", () => {
    const approvals = Array.from({ length: 10 }, () => approval());
    const r = buildReport({ approvals, balances, freshSpenders: [] });
    // 10 approvals: (10-8)*2 = 4 deduction
    expect(r.healthScore).toBe(96);
    expect(r.flags.some((f) => f.id === "surface")).toBe(true);
  });

  it("single-asset concentration is informational, not a verdict escalation", () => {
    const r = buildReport({
      approvals: [],
      balances: [{ symbol: "USDC", amount: 100 }],
      freshSpenders: [],
    });
    expect(r.healthScore).toBe(96);
    expect(r.verdict).toBe("ALLOW");
    const flag = r.flags.find((f) => f.id === "concentration");
    expect(flag?.severity).toBe("info");
  });

  it("respects a custom freshThresholdDays", () => {
    const spender = addr();
    // age 10 days; with default threshold 7 this is NOT fresh, with 14 it IS.
    const base = {
      approvals: [approval({ spender })],
      balances,
      freshSpenders: [fresh(spender, 10)],
    };
    const def = buildReport(base);
    expect(def.stats.freshApprovals).toBe(0);
    const wide = buildReport({ ...base, freshThresholdDays: 14 });
    expect(wide.stats.freshApprovals).toBe(1);
  });
});
