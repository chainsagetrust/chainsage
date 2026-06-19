# chainsage

**Ask ChainSage for a verdict before your agent signs.** One call — `cs.check(intent)` —
returns **ALLOW / REVIEW / DENY**, grounded in live Base reads. It **fails safe**: a network
error or timeout never yields a silent ALLOW.

> Settlement moves money. Authorization grants permission. **ChainSage decides whether it
> should happen.** This SDK is that pre-signature moment, in package form.

```bash
npm install chainsage viem
```

## Quick start

```ts
import { ChainSage } from "chainsage";

const cs = new ChainSage(); // local mode by default

const verdict = await cs.check({
  kind: "approve",
  chain: "base",
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  spender: "0x…",
  amount: "unlimited",
  owner: "0x…",
});

verdict.decision; // "ALLOW" | "REVIEW" | "DENY"
verdict.score;    // 0–100, always inside the band for `decision`
verdict.reasons;  // why — each maps to a real check
verdict.verdictId;// audit id
verdict.notChecked; // what was NOT verified (no fabricated checks)
```

### `guard()` — only execute on ALLOW

```ts
import { ChainSage, ChainSageDenied, ChainSageReview } from "chainsage";

const cs = new ChainSage();
try {
  await cs.guard(intent, () => wallet.signAndSend(tx)); // runs ONLY if ALLOW
} catch (e) {
  if (e instanceof ChainSageDenied) {/* blocked — verdict on e.verdict */}
  if (e instanceof ChainSageReview) {/* held for human */}
}
```

- **DENY** → throws `ChainSageDenied` (execute never runs).
- **REVIEW** → per `onReview` (default `"deny"` → throws `ChainSageReview`; `"allow"` to
  proceed; or pass `(verdict) => boolean | Promise<boolean>` to ask a human/approver).
- **ALLOW** → runs `execute()` and returns its result.

## The fail-safe guarantee

A trust layer that fails open is worse than none. `check()` **never returns ALLOW when it
could not actually compute a verdict.** Any network error, timeout, or read failure produces
a non-ALLOW fail-safe verdict (`failSafe: true`):

```ts
const cs = new ChainSage({ mode: "api", onError: "REVIEW" }); // default
// If the API is unreachable → verdict.decision === "REVIEW", verdict.failSafe === true.

const strict = new ChainSage({ mode: "api", onError: "DENY" }); // fail closed
```

This is covered by tests (`src/sdk.test.ts`): a thrown fetch, an API error, and a timeout
each assert `decision !== "ALLOW"`.

## `Intent`

A discriminated union — the on-chain-checkable subset today:

```ts
type Intent =
  | { kind: "approve";  chain: "base"; token; spender; amount: bigint | "unlimited"; owner }
  | { kind: "transfer"; chain: "base"; token; to;      amount: bigint; owner }
  | { kind: "swap";     chain: "base"; tokenIn; tokenOut; amountIn: bigint; owner }
  | { kind: "x402_pay"; chain: "base"; to; amount: bigint; owner };  // FORWARD-LOOKING
```

What each check actually reads (everything else is in `verdict.notChecked`):

| Intent      | Real on-chain checks                                                        |
| ----------- | --------------------------------------------------------------------------- |
| `approve`   | classifies the **spender** (EOA/contract, bounded age, known-good) × amount |
| `transfer`  | destination class + zero-address + token-self (unrecoverable) checks        |
| `swap`      | classifies **both token contracts** (route/price/slippage are NOT simulated)|
| `x402_pay`  | treated as a value transfer to `to` — **experimental, x402 is not yet live** |

## `api` vs `local` mode

```ts
new ChainSage({ mode: "local" }); // default — runs the shared engine in-process
new ChainSage({ mode: "api", apiUrl: "https://…", apiKey: "…" }); // calls the Risk API
```

- **local** — no network hop to ChainSage; lowest latency. Requires the engine (bundled) and
  a Base RPC (`BASE_RPC_URL`). Best for server-side agents.
- **api** — calls the hosted Phase-2 Risk API. No RPC needed by the caller; the verdict logic
  runs on the server. Best for browser/edge or when you don't want to manage an RPC.

Both modes use the **same verdict engine** (`@chainsage/engine`) — there is no second copy of
the logic. Config also reads `CHAINSAGE_API_URL` / `CHAINSAGE_API_KEY` from the environment.

## Auditability

Every `Verdict` carries a unique `verdictId` and echoes the exact `intent` it judged, plus a
`source` (`api`/`local`), an ISO `at` timestamp, and `failSafe`. Log the whole object.

## MCP tool (experimental)

```ts
import { createChainSageMcpTool } from "chainsage/mcp";
const tool = createChainSageMcpTool(); // { name, description, inputSchema, handler }
// register `tool` with your MCP server. Thin, dependency-free, shape may change.
```

## Experimental / not-yet-live

- **`x402_pay`** — x402 settlement is **not live**. The SDK treats it as a value transfer to
  `to` for the verdict and sets `experimental: true`. Do not read it as production x402 support.
- **MCP wrapper** — experimental; not covered by stability guarantees.
- **Contract age** — a bounded estimate (public-RPC friendly), not an exact deploy block.

## Build / test

```bash
npm run build      # tsup → dist/ (ESM + .d.ts), engine inlined, viem external
npm test           # vitest — fail-safe, mapping, guard, score-band invariant
npm run typecheck  # tsc --noEmit
```

Peer dependency: `viem` (^2.21).
