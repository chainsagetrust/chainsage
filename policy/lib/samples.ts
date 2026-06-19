/**
 * Sample intents, token display metadata, and a sensible default policy for the
 * test bench. The intents are realistic Base-shaped actions; the per-scenario
 * `context` is HAND-AUTHORED sample facts (clearly labelled in the UI) so the
 * bench is instant and deterministic. Each scenario can also pull LIVE facts for
 * its counterparty via /api/context (Guardian's reads) to show the real path.
 */
import type { Address, Intent, Policy, PolicyContext } from "@chainsage/policy-engine";

// --- well-known Base addresses (real) -------------------------------------
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
export const WETH = "0x4200000000000000000000000000000000000006" as Address;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
export const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;

// --- illustrative counterparties (fictional, for the demo) ----------------
export const FRIEND = "0x4d2e0A3F1b9C8E7d6A5B4c3D2e1F0a9b8C7d6E5f" as Address;
export const FRESH_CONTRACT = "0x9A1f2C3b4D5e6F708192A3b4C5d6e7F80a1B2c3D" as Address;
export const BLOCKED_DRAINER = "0xBADc0FFEE0DDF00D1234567890aBcDef12345678" as Address;

/** Token display metadata for formatting raw amounts. Keyed by lowercased address. */
export const TOKEN_META: Record<string, { symbol: string; decimals: number }> = {
  [USDC.toLowerCase()]: { symbol: "USDC", decimals: 6 },
  [WETH.toLowerCase()]: { symbol: "WETH", decimals: 18 },
};

const NATIVE = { symbol: "ETH", decimals: 18 };

/** USDC has 6 decimals: 1 USDC = 1_000_000 raw units. */
const usdc = (whole: number) => BigInt(whole) * 1_000_000n;

/**
 * A sensible starting policy for an owner delegating to an agent. The builder
 * loads this on first visit; every field maps 1:1 to a control.
 */
export const DEFAULT_POLICY: Policy = {
  allowedChains: ["base"],
  spendLimits: [{ token: USDC, maxPerTx: usdc(1000), maxPerDay: usdc(5000) }],
  allowedProtocols: [UNIVERSAL_ROUTER, PERMIT2, FRIEND],
  blockedProtocols: [BLOCKED_DRAINER],
  approvalRules: { allowUnlimited: false },
  trustThreshold: 0.6,
  freshContractPolicy: "review",
};

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  intent: Intent;
  /** Hand-authored sample facts for this scenario. */
  context: PolicyContext;
  /** The counterparty address whose live facts can be resolved, if any. */
  counterparty: Address | null;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "routine-transfer",
    title: "Routine payment",
    blurb: "Send 500 USDC to an allow-listed, trusted payee.",
    intent: { kind: "transfer", chain: "base", token: USDC, to: FRIEND, amount: usdc(500), owner: FRIEND },
    context: { counterpartyIsFresh: false, counterpartyTrust: 0.85 },
    counterparty: FRIEND,
  },
  {
    id: "bounded-approval",
    title: "Bounded approval",
    blurb: "Approve exactly 800 USDC to the Uniswap router.",
    intent: { kind: "approve", chain: "base", token: USDC, spender: UNIVERSAL_ROUTER, amount: usdc(800), owner: FRIEND },
    context: { counterpartyIsFresh: false, counterpartyTrust: 1 },
    counterparty: UNIVERSAL_ROUTER,
  },
  {
    id: "unlimited-approval",
    title: "Unlimited approval",
    blurb: "Approve UNLIMITED USDC — even to a trusted, allow-listed spender.",
    intent: { kind: "approve", chain: "base", token: USDC, spender: PERMIT2, amount: "unlimited", owner: FRIEND },
    context: { counterpartyIsFresh: false, counterpartyTrust: 1 },
    counterparty: PERMIT2,
  },
  {
    id: "big-swap",
    title: "Oversized swap",
    blurb: "Swap 4,000 USDC after 3,000 already moved today.",
    intent: { kind: "swap", chain: "base", tokenIn: USDC, tokenOut: WETH, amountIn: usdc(4000), owner: FRIEND },
    context: { spentTodayByToken: { [USDC.toLowerCase()]: usdc(3000) } },
    counterparty: null,
  },
  {
    id: "fresh-payment",
    title: "Payment to a fresh contract",
    blurb: "An x402 micropayment to a freshly deployed, low-trust address.",
    intent: { kind: "x402_pay", chain: "base", to: FRESH_CONTRACT, amount: 10_000_000_000_000_000n, owner: FRIEND },
    context: { counterpartyIsFresh: true, counterpartyTrust: 0.2 },
    counterparty: FRESH_CONTRACT,
  },
  {
    id: "blocked-approval",
    title: "Approval to a blocked drainer",
    blurb: "Approve a known-bad spender that's on the denylist.",
    intent: { kind: "approve", chain: "base", token: USDC, spender: BLOCKED_DRAINER, amount: usdc(800), owner: FRIEND },
    context: { counterpartyIsFresh: false, counterpartyTrust: 0.5 },
    counterparty: BLOCKED_DRAINER,
  },
];

// --- formatting -----------------------------------------------------------

function fmt(raw: bigint, decimals: number, symbol: string): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return `${whole.toLocaleString()} ${symbol}`;
  // Trim trailing zeros on the fractional part, cap to 4 places for display.
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return `${whole.toLocaleString()}${fracStr ? "." + fracStr : ""} ${symbol}`;
}

/** A short, human amount for an intent (e.g. "500 USDC", "Unlimited", "0.01 ETH"). */
export function intentAmount(intent: Intent): string {
  switch (intent.kind) {
    case "approve":
      if (intent.amount === "unlimited") return "Unlimited";
      return fmt(intent.amount, meta(intent.token).decimals, meta(intent.token).symbol);
    case "transfer":
      return fmt(intent.amount, meta(intent.token).decimals, meta(intent.token).symbol);
    case "swap":
      return fmt(intent.amountIn, meta(intent.tokenIn).decimals, meta(intent.tokenIn).symbol);
    case "x402_pay":
      return fmt(intent.amount, NATIVE.decimals, NATIVE.symbol);
  }
}

function meta(token: Address): { symbol: string; decimals: number } {
  return TOKEN_META[token.toLowerCase()] ?? { symbol: token.slice(0, 6), decimals: 18 };
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
