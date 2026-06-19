/**
 * Scenario DISPLAY metadata (no bigints — safe to import on the client).
 * The actual typed Intents (with bigint amounts) live server-side in
 * app/api/check/route.ts, keyed by these ids, and are checked by the real SDK.
 *
 * Every `expected` verdict below is computed LIVE by cs.check() against Base —
 * it is not hard-coded into the result. These four intents were chosen so their
 * verdicts are both real and STABLE (they don't depend on a contract's age,
 * which changes over time).
 */
export type ExpectedDecision = "ALLOW" | "REVIEW" | "DENY";

export interface ScenarioMeta {
  id: string;
  step: number;
  title: string;
  narrative: string;
  intentSummary: string;
  expected: ExpectedDecision;
  experimental?: boolean;
  /** What is genuinely read on-chain. */
  realNote: string;
  /** What is simulated/labeled (if anything). */
  simNote?: string;
  /** What "execute" means on ALLOW (always a simulation in this demo). */
  executeLabel?: string;
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    id: "swap",
    step: 1,
    title: "Swap 500 USDC → WETH",
    narrative: "The agent rebalances its treasury: swap 500 USDC into WETH on Base.",
    intentSummary: 'swap { amountIn: 500 USDC, tokenOut: WETH }',
    expected: "ALLOW",
    realNote: "Both token contracts are classified live on Base (established, known ERC-20s).",
    simNote: "The swap route, price, slippage and output amount are simulated — not executed.",
    executeLabel: "Swap routed · received ~0.14 WETH (simulated outcome)",
  },
  {
    id: "transfer-self",
    step: 2,
    title: "Transfer 5,000 USDC to the token contract",
    narrative:
      "The agent miscodes a destination and attempts to send 5,000 USDC to the USDC token contract itself — funds that would be unrecoverable.",
    intentSummary: 'transfer { 5,000 USDC → USDC token contract }',
    expected: "DENY",
    realNote:
      "The destination is read live and compared to the token contract. This is a real, permanent DENY rule — it never depends on timing.",
  },
  {
    id: "approve-unknown",
    step: 3,
    title: "Approve UNLIMITED USDC to an unknown spender",
    narrative:
      "The agent is asked to grant an unlimited USDC allowance to an unfamiliar spender. (The same engine rule sends an unlimited approval to a freshly-deployed contract straight to DENY.)",
    intentSummary: 'approve { amount: unlimited, spender: <unknown> }',
    expected: "REVIEW",
    realNote:
      "The spender is classified live on Base — EOA vs contract, bounded age, and the known-good allowlist.",
  },
  {
    id: "x402",
    step: 4,
    title: "x402 micropayment to an API provider",
    narrative: "The agent pays a $0.25 x402 micropayment to a service it is calling.",
    intentSummary: 'x402_pay { 0.25 USDC → provider }',
    expected: "ALLOW",
    experimental: true,
    realNote: "The destination is classified live on Base.",
    simNote:
      "x402 settlement is FORWARD-LOOKING — not live. The SDK treats it as a value transfer to `to` and flags the verdict experimental.",
    executeLabel: "Micropayment authorized (simulated — x402 is not yet live)",
  },
];
