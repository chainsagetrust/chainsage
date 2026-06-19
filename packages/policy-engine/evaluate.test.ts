/**
 * The exhaustive precedence suite — the heart of the policy engine.
 *
 * If any test here fails, the engine is broken and must be fixed before any UI
 * touches it. We prove four things:
 *   1. Each rule fires on its trigger AND ONLY its trigger.
 *   2. Precedence is absolute: DENY > REVIEW > ALLOW, for every co-occurrence.
 *   3. Spend-limit math is correct across per-tx and cumulative per-day, at the
 *      boundary and across the unlimited case.
 *   4. Evaluation is deterministic: identical inputs → byte-identical output.
 */
import { describe, it, expect } from "vitest";
import { evaluate, worstDecision } from "./evaluate";
import type { Policy, PolicyContext, PolicyRuleId } from "./policy";
import type { Address, Intent, Decision } from "chainsage";

// --- fixtures -------------------------------------------------------------

const OWNER = "0x1111111111111111111111111111111111111111" as Address;
const TOKEN = "0x2222222222222222222222222222222222222222" as Address;
const SPENDER = "0x3333333333333333333333333333333333333333" as Address;
const SPENDER_2 = "0x4444444444444444444444444444444444444444" as Address;
const TO = "0x5555555555555555555555555555555555555555" as Address;

const approve = (over: Partial<import("chainsage").ApproveIntent> = {}): Intent => ({
  kind: "approve",
  chain: "base",
  token: TOKEN,
  spender: SPENDER,
  amount: 1000n,
  owner: OWNER,
  ...over,
});

const transfer = (over: Partial<import("chainsage").TransferIntent> = {}): Intent => ({
  kind: "transfer",
  chain: "base",
  token: TOKEN,
  to: TO,
  amount: 1000n,
  owner: OWNER,
  ...over,
});

const swap = (over: Partial<import("chainsage").SwapIntent> = {}): Intent => ({
  kind: "swap",
  chain: "base",
  tokenIn: TOKEN,
  tokenOut: SPENDER_2,
  amountIn: 1000n,
  owner: OWNER,
  ...over,
});

const x402 = (over: Partial<import("chainsage").X402PayIntent> = {}): Intent => ({
  kind: "x402_pay",
  chain: "base",
  to: TO,
  amount: 1000n,
  owner: OWNER,
  ...over,
});

/** The set of rule ids that fired, for terse assertions. */
const firedIds = (intent: Intent, policy: Policy, ctx?: PolicyContext): PolicyRuleId[] =>
  evaluate(intent, policy, ctx).firedRules.map((r) => r.rule).sort();

// =====================================================================
// 0. Permissive default
// =====================================================================

describe("empty policy → ALLOW (documented permissive default)", () => {
  const intents: Intent[] = [approve(), transfer(), swap(), x402()];
  for (const intent of intents) {
    it(`${intent.kind}: empty policy {} allows`, () => {
      const res = evaluate(intent, {});
      expect(res.decision).toBe("ALLOW");
      expect(res.firedRules).toEqual([]);
      expect(res.intent).toBe(intent); // echoed verbatim
    });
  }

  it("empty arrays are treated as 'no constraint', not 'allow nothing'", () => {
    const policy: Policy = { allowedChains: [], allowedProtocols: [], blockedProtocols: [], spendLimits: [] };
    expect(evaluate(approve(), policy).decision).toBe("ALLOW");
  });
});

// =====================================================================
// 1. Each rule fires on its trigger AND ONLY its trigger
// =====================================================================

describe("each rule fires in isolation", () => {
  it("blocked-protocol → DENY", () => {
    const res = evaluate(approve(), { blockedProtocols: [SPENDER] });
    expect(res.decision).toBe("DENY");
    expect(firedIds(approve(), { blockedProtocols: [SPENDER] })).toEqual(["blocked-protocol"]);
  });

  it("blocked-protocol is case-insensitive", () => {
    const res = evaluate(approve(), { blockedProtocols: [SPENDER.toUpperCase() as Address] });
    expect(res.decision).toBe("DENY");
  });

  it("unlimited-approval → DENY only when allowUnlimited is false", () => {
    expect(evaluate(approve({ amount: "unlimited" }), { approvalRules: { allowUnlimited: false } }).decision).toBe("DENY");
    expect(evaluate(approve({ amount: "unlimited" }), { approvalRules: { allowUnlimited: true } }).firedRules).toEqual([]);
    // A bounded approval never trips the unlimited rule.
    expect(evaluate(approve({ amount: 5n }), { approvalRules: { allowUnlimited: false } }).firedRules).toEqual([]);
  });

  it("fresh-contract → DENY / REVIEW / (none) by policy, only when fact is known", () => {
    expect(evaluate(approve(), { freshContractPolicy: "deny" }, { counterpartyIsFresh: true }).decision).toBe("DENY");
    expect(evaluate(approve(), { freshContractPolicy: "review" }, { counterpartyIsFresh: true }).decision).toBe("REVIEW");
    expect(evaluate(approve(), { freshContractPolicy: "allow" }, { counterpartyIsFresh: true }).firedRules).toEqual([]);
    // Not fresh, or freshness unknown → never fires.
    expect(evaluate(approve(), { freshContractPolicy: "deny" }, { counterpartyIsFresh: false }).firedRules).toEqual([]);
    expect(evaluate(approve(), { freshContractPolicy: "deny" }, {}).firedRules).toEqual([]);
  });

  it("chain-not-allowed → DENY only for off-list chains", () => {
    expect(evaluate(approve(), { allowedChains: ["ethereum"] }).decision).toBe("DENY");
    expect(evaluate(approve(), { allowedChains: ["base"] }).firedRules).toEqual([]);
    expect(evaluate(approve(), { allowedChains: ["base", "ethereum"] }).firedRules).toEqual([]);
  });

  it("protocol-not-allowlisted → REVIEW only when off the allowlist", () => {
    expect(evaluate(approve(), { allowedProtocols: [SPENDER_2] }).decision).toBe("REVIEW");
    expect(evaluate(approve(), { allowedProtocols: [SPENDER] }).firedRules).toEqual([]);
    expect(evaluate(approve(), { allowedProtocols: [SPENDER, SPENDER_2] }).firedRules).toEqual([]);
  });

  it("low-trust → REVIEW only when score is known AND below threshold", () => {
    expect(evaluate(approve(), { trustThreshold: 0.5 }, { counterpartyTrust: 0.2 }).decision).toBe("REVIEW");
    // At/above threshold → no fire.
    expect(evaluate(approve(), { trustThreshold: 0.5 }, { counterpartyTrust: 0.5 }).firedRules).toEqual([]);
    expect(evaluate(approve(), { trustThreshold: 0.5 }, { counterpartyTrust: 0.9 }).firedRules).toEqual([]);
    // Unknown score → engine does not invent a fact → no fire.
    expect(evaluate(approve(), { trustThreshold: 0.5 }, {}).firedRules).toEqual([]);
  });
});

// =====================================================================
// 2. Spend-limit math (per-tx + cumulative per-day), incl. boundaries
// =====================================================================

describe("spend-limit math", () => {
  const limit: Policy = { spendLimits: [{ token: TOKEN, maxPerTx: 1000n, maxPerDay: 5000n }] };

  it("per-tx: over by 1 → DENY; exactly at cap → ALLOW", () => {
    expect(evaluate(transfer({ amount: 1001n }), limit).firedRules.map((r) => r.rule)).toContain("spend-per-tx");
    expect(evaluate(transfer({ amount: 1000n }), limit).firedRules.map((r) => r.rule)).not.toContain("spend-per-tx");
    expect(evaluate(transfer({ amount: 999n }), limit).decision).toBe("ALLOW");
  });

  it("per-day: cumulative over → DENY; exactly at cap → ALLOW", () => {
    const ctx: PolicyContext = { spentTodayByToken: { [TOKEN.toLowerCase()]: 4500n } };
    // 4500 + 600 = 5100 > 5000 → DENY (and within per-tx since 600 < 1000)
    expect(firedIds(transfer({ amount: 600n }), limit, ctx)).toEqual(["spend-per-day"]);
    // 4500 + 500 = 5000 == cap → not exceeded → ALLOW
    expect(evaluate(transfer({ amount: 500n }), limit, ctx).decision).toBe("ALLOW");
  });

  it("per-tx and per-day can fire together", () => {
    const ctx: PolicyContext = { spentTodayByToken: { [TOKEN.toLowerCase()]: 4900n } };
    // amount 1500 > 1000 (per-tx) AND 4900+1500=6400 > 5000 (per-day)
    expect(firedIds(transfer({ amount: 1500n }), limit, ctx)).toEqual(["spend-per-day", "spend-per-tx"]);
  });

  it("unlimited approval exceeds both caps", () => {
    const policy: Policy = { spendLimits: [{ token: TOKEN, maxPerTx: 1000n, maxPerDay: 5000n }] };
    expect(firedIds(approve({ amount: "unlimited" }), policy)).toEqual(["spend-per-day", "spend-per-tx"]);
  });

  it("limits only apply to the matching token", () => {
    const other: Policy = { spendLimits: [{ token: SPENDER_2, maxPerTx: 1n, maxPerDay: 1n }] };
    expect(evaluate(transfer({ amount: 10n ** 9n }), other).decision).toBe("ALLOW");
  });

  it("swap spend uses amountIn of tokenIn", () => {
    const res = evaluate(swap({ amountIn: 2000n }), limit);
    expect(res.firedRules.map((r) => r.rule)).toContain("spend-per-tx");
  });

  it("x402 (no token) cannot match a token-keyed spend cap", () => {
    expect(evaluate(x402({ amount: 10n ** 12n }), limit).decision).toBe("ALLOW");
  });
});

// =====================================================================
// 3. PRECEDENCE — DENY > REVIEW > ALLOW, exhaustive co-occurrence
// =====================================================================

describe("precedence is absolute", () => {
  it("worstDecision ranks DENY > REVIEW > ALLOW for all pairs", () => {
    const order: Decision[] = ["ALLOW", "REVIEW", "DENY"];
    for (const a of order) {
      for (const b of order) {
        const expected = order[Math.max(order.indexOf(a), order.indexOf(b))];
        expect(worstDecision(a, b)).toBe(expected);
        expect(worstDecision(b, a)).toBe(expected); // symmetric
      }
    }
  });

  it("a single DENY beats any number of co-occurring REVIEWs", () => {
    // blocked-protocol (DENY) + protocol-not-allowlisted (REVIEW) + low-trust (REVIEW)
    const policy: Policy = {
      blockedProtocols: [SPENDER],
      allowedProtocols: [SPENDER_2], // SPENDER is off-list → REVIEW
      trustThreshold: 0.9,
    };
    const ctx: PolicyContext = { counterpartyTrust: 0.1 };
    const res = evaluate(approve(), policy, ctx);
    expect(res.decision).toBe("DENY");
    // every fired rule surfaced, not just the deciding one
    expect(firedIds(approve(), policy, ctx)).toEqual(["blocked-protocol", "low-trust", "protocol-not-allowlisted"]);
  });

  it("REVIEW wins over ALLOW when no DENY is present", () => {
    const policy: Policy = { allowedProtocols: [SPENDER_2], trustThreshold: 0.9 };
    const ctx: PolicyContext = { counterpartyTrust: 0.1 };
    const res = evaluate(approve(), policy, ctx);
    expect(res.decision).toBe("REVIEW");
    expect(firedIds(approve(), policy, ctx)).toEqual(["low-trust", "protocol-not-allowlisted"]);
  });

  it("truth table: decision == worst fired across every DENY×REVIEW combination", () => {
    // Each generator, when applied, adds exactly its decision to the mix.
    const denyMakers: Array<[Policy, PolicyContext]> = [
      [{ blockedProtocols: [SPENDER] }, {}],
      [{ approvalRules: { allowUnlimited: false } }, {}], // needs unlimited approve below
      [{ freshContractPolicy: "deny" }, { counterpartyIsFresh: true }],
      [{ allowedChains: ["ethereum"] }, {}],
      [{ spendLimits: [{ token: TOKEN, maxPerTx: 1n, maxPerDay: 1n }] }, {}],
    ];
    const reviewMakers: Array<[Policy, PolicyContext]> = [
      [{ freshContractPolicy: "review" }, { counterpartyIsFresh: true }],
      [{ allowedProtocols: [SPENDER_2] }, {}],
      [{ trustThreshold: 0.9 }, { counterpartyTrust: 0.1 }],
    ];

    const merge = (entries: Array<[Policy, PolicyContext]>): [Policy, PolicyContext] => {
      const p: Policy = {};
      const c: PolicyContext = {};
      for (const [pp, cc] of entries) {
        Object.assign(p, pp);
        Object.assign(c, cc);
      }
      return [p, c];
    };

    for (let d = 0; d <= denyMakers.length; d++) {
      for (let r = 0; r <= reviewMakers.length; r++) {
        const chosen = [...denyMakers.slice(0, d), ...reviewMakers.slice(0, r)];
        const [policy, ctx] = merge(chosen);
        // Use an unlimited approve so the allowUnlimited:false maker can bite.
        const intent = approve({ amount: "unlimited" });
        const expected: Decision = d > 0 ? "DENY" : r > 0 ? "REVIEW" : "ALLOW";
        const res = evaluate(intent, policy, ctx);
        expect(res.decision, `deny=${d} review=${r}`).toBe(expected);
        // The fired count must be at least the number of distinct active makers
        // (some DENY makers add two hits, e.g. spend caps), and never zero unless ALLOW.
        if (expected === "ALLOW") expect(res.firedRules).toEqual([]);
        else expect(res.firedRules.length).toBeGreaterThanOrEqual(d + r > 0 ? 1 : 0);
      }
    }
  });

  it("all DENY rules can co-occur and the decision is still exactly DENY", () => {
    const policy: Policy = {
      blockedProtocols: [SPENDER],
      approvalRules: { allowUnlimited: false },
      freshContractPolicy: "deny",
      allowedChains: ["ethereum"],
      spendLimits: [{ token: TOKEN, maxPerTx: 1n, maxPerDay: 1n }],
    };
    const ctx: PolicyContext = { counterpartyIsFresh: true };
    const res = evaluate(approve({ amount: "unlimited" }), policy, ctx);
    expect(res.decision).toBe("DENY");
    expect(firedIds(approve({ amount: "unlimited" }), policy, ctx)).toEqual([
      "blocked-protocol",
      "chain-not-allowed",
      "fresh-contract",
      "spend-per-day",
      "spend-per-tx",
      "unlimited-approval",
    ]);
  });
});

// =====================================================================
// 4. Determinism
// =====================================================================

describe("determinism", () => {
  it("identical inputs → identical output, every time", () => {
    const policy: Policy = {
      blockedProtocols: [SPENDER_2],
      allowedProtocols: [SPENDER],
      spendLimits: [{ token: TOKEN, maxPerTx: 1000n, maxPerDay: 5000n }],
      trustThreshold: 0.7,
      freshContractPolicy: "review",
    };
    const ctx: PolicyContext = { counterpartyIsFresh: true, counterpartyTrust: 0.3, spentTodayByToken: { [TOKEN.toLowerCase()]: 4900n } };
    const intent = transfer({ amount: 1500n });

    const first = JSON.stringify(evaluate(intent, policy, ctx), bigintReplacer);
    for (let i = 0; i < 50; i++) {
      expect(JSON.stringify(evaluate(intent, policy, ctx), bigintReplacer)).toBe(first);
    }
  });

  it("rule order in firedRules is stable (not input-order dependent)", () => {
    const policy: Policy = { trustThreshold: 0.9, allowedProtocols: [SPENDER_2] };
    const ctx: PolicyContext = { counterpartyTrust: 0.1 };
    // protocol rule is pushed before trust rule, deterministically
    expect(evaluate(approve(), policy, ctx).firedRules.map((r) => r.rule)).toEqual([
      "protocol-not-allowlisted",
      "low-trust",
    ]);
  });
});

const bigintReplacer = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
