# ChainSage Agent SDK — live demo

An investor-grade interactive demo of [`chainsage`](../packages/chainsage-sdk): an autonomous
agent attempts four actions, and each is gated by **`chainsage.check()`** before it would sign.
The UI animates the pipeline → verdict and visibly **blocks on DENY**.

> Machines call the verdict. This is the pre-signature moment, running for real.

```bash
npm install      # links chainsage (built) + viem
npm run dev      # http://localhost:3002
```

> The demo runs the SDK in **local mode inside its `/api/check` route** (server-side), so the
> Base RPC stays on the server. Build the SDK first if you've changed it: `cd
> ../packages/chainsage-sdk && npm run build`.

## The four scenarios

| # | Action | Verdict | What happens |
|---|--------|---------|--------------|
| 1 | Swap 500 USDC → WETH | **ALLOW** | executes (simulated swap output) |
| 2 | Transfer 5,000 USDC to the USDC token contract | **DENY** | `guard()` throws `ChainSageDenied` — agent halts |
| 3 | Approve UNLIMITED USDC to an unknown spender | **REVIEW** | `guard()` throws `ChainSageReview` — held for human |
| 4 | x402 micropayment (forward-looking) | **ALLOW** | authorized (simulated — x402 not live) |

Every verdict is **computed live** by the real SDK against Base — none is hard-coded. The
four intents were chosen so their verdicts are **stable** (they don't depend on a contract's
age, which changes over time): scenario 2's "send to the token contract" is a permanent,
real DENY rule.

## Honest labeling (a hard constraint)

- **Real:** verdicts, and the on-chain classification of spenders/destinations/tokens via the
  shared `@chainsage/engine`. The DENY is genuinely computed, not theater.
- **Simulated:** *execution* — the demo never signs or broadcasts. Swap route/price/output are
  not simulated (only the token contracts are classified).
- **Forward-looking:** `x402_pay` — x402 settlement is not live; treated as a value transfer
  and flagged `experimental`. Pipeline stages **Policy** and **Trust network** are roadmap
  (Phase 4/5) and do not yet contribute to the verdict — they're labeled `· roadmap`.

## How it maps to the brief's scenarios

The brief's "approve unlimited to a *freshly-deployed* spender → DENY" is the same engine rule
(`fresh + unlimited → DENY`). Because a real contract's freshness *ages out within ~a week*, a
hard-coded fresh address would silently flip to REVIEW/ALLOW over time — which would be DENY
theater. So the guaranteed, never-aging DENY here is **transfer-to-the-token-contract** (funds
unrecoverable), and the unlimited-approval risk is shown as the REVIEW beat. Both are real and
stable. See `lib/scenarios.ts`.

Configuration: set `BASE_RPC_URL` (server-only) for a fast, reliable RPC; otherwise it falls
back to the public Base endpoint.
