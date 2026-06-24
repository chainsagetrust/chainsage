# ChainSage Risk API

**Trust as a service.** The same verdict engine behind [Guardian](../guardian) — wallet
health scoring, spender classification, and pre-sign transaction simulation — exposed as a
clean HTTP API any wallet, dApp, or on-ramp can call.

> Settlement moves money. Authorization grants permission. **ChainSage decides whether it
> should happen.**

Every verdict is one of **`ALLOW` / `REVIEW` / `DENY`**, grounded in **live Base mainnet
reads**. The API is read-only: it never holds keys, never signs, and never builds
transactions — it returns a verdict.

---

## Architecture — one source of truth

The verdict logic and on-chain reads live in [`../packages/engine`](../packages/engine)
(`@chainsage/engine`), consumed by **both** Guardian and this API. There is no second copy
of the verdict engine — `buildReport()` and its 11 calibration tests are shared.

```
packages/engine     ← chain.ts (Base reads) + risk.ts (verdict engine) + verdict.ts
   ├── guardian      depends on it  (lib/chain.ts, lib/risk.ts are thin re-export shims)
   └── risk-api      depends on it  (lib/score.ts, lib/classify.ts, lib/simulate.ts)
```

The score endpoint runs Guardian's **exact** scan path; classify/simulate add new
heuristics on top of the same on-chain primitives (`getCode`, `getContractAgeDays`,
`getAllowance`, `getTokenMeta`).

---

## Endpoints

All endpoints are **`POST`**, versioned under **`/api/v1`**, and return
`{ ok: true, data }` or `{ ok: false, error: { code, message } }` with a correct HTTP
status code. Authenticate with the **`x-api-key`** header.

### `POST /api/v1/score`

Wallet health + actionable flags. Body: `{ "address": "0x…" }`.

Returns the full `WalletReport` — `healthScore` (0–100), `verdict`, `flags[]`, `stats` —
plus `meta: { scannedAt, blockNumber, chain: "base" }`.

```bash
curl -s https://your-host/api/v1/score \
  -H "content-type: application/json" \
  -H "x-api-key: demo" \
  -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

### `POST /api/v1/classify`

Is this spender/contract risky? Body: `{ "address": "0x…" }`.

Returns `{ verdict, isContract, ageDays, isFresh, knownGood, signals[] }`. Grounded in
on-chain reads only: EOA-vs-contract (`getCode`), bounded contract age, and a curated
known-good allowlist (Permit2, Uniswap routers on Base).

| Spender                       | Verdict  |
| ----------------------------- | -------- |
| Known-good (allowlist)        | `ALLOW`  |
| Established contract (≥7d)    | `ALLOW`  |
| Freshly deployed contract <7d | `REVIEW` |
| EOA (not a contract)          | `REVIEW` |

### `POST /api/v1/simulate`

Verdict for a proposed intent **before it's signed**.

```jsonc
// approve
{ "type": "approve", "token": "0x…", "spender": "0x…", "amount": "unlimited" }
// transfer
{ "type": "transfer", "token": "0x…", "to": "0x…", "amount": "100.5" }
```

`amount` is a human-readable token amount (e.g. `"100.5"`) or the literal
`"unlimited"` / `"max"` / `"infinite"`.

Returns `{ verdict, reasons[], wouldExposeUnlimited?, spenderClassification?,
destinationClassification?, notChecked[] }`.

**approve** calibration (leans on the spender classification, matching Guardian):

| Spender             | Amount    | Verdict  |
| ------------------- | --------- | -------- |
| Fresh contract      | unlimited | `DENY`   |
| Fresh contract      | limited   | `REVIEW` |
| EOA                 | any       | `REVIEW` |
| Established contract| unlimited | `REVIEW` |
| Established contract| limited   | `ALLOW`  |
| Known-good          | any       | `ALLOW`  |

**transfer** is destination-only (we have no `from`): zero address → `DENY`, the token's
own contract → `DENY`, fresh-contract destination → `REVIEW`, otherwise `ALLOW`.

> **No fabricated checks.** Every returned signal maps to a real read. The response
> carries an explicit **`notChecked[]`** listing what was *not* simulated (e.g. token
> honesty, your balance/allowance — the intent has no owner address).

### `POST /api/v1/guard`

The **Guardian verdict** for a proposed intent. Accepts the same `approve` / `transfer`
intent shape as `/simulate`, gathers signals server-side (live Base reads via the server
RPC), and runs the shared **`decide()`** combiner from `@chainsage/engine` — the *same*
combiner the Agent SDK calls. There is no second copy of the verdict logic.

```jsonc
// add an optional `from` (owner) to enable live transaction-effect simulation:
{ "type": "approve", "token": "0x…", "spender": "0x…", "amount": "unlimited", "from": "0x…" }
```

Returns `{ verdict, reasons[], simulated, simProvider, reverted, verdictId, signals[],
notChecked[], spenderClassification?, destinationClassification? }`.

The verdict is the worst severity across all gathered signals (`DENY > REVIEW > ALLOW`).
Approval/transfer signals are **live** (same calibration as `/simulate`).

**Transaction-effect simulation (live).** When the request carries a `from` (owner) **and**
a provider is configured, `/guard` simulates the proposed tx against live Base state before
signing and feeds the combiner real effects:

- **hidden-transfer / over-approval** — funds reach an address other than the stated
  counterparty, or the tx grants approvals beyond the stated intent → **DENY**.
- **intent-mismatch** — the simulated net effect contradicts the declared intent (wrong
  token/recipient, or a materially short delivery, e.g. fee-on-transfer) → **DENY**.
- **revert** — the tx reverts in simulation (won't execute as intended) → **REVIEW**.

`simProvider` reports which provider ran — `tenderly` · `rpc-trace` · `rpc-call` (degraded,
revert-only) · `none`. **`simulated` is `true` only when a real effect simulation ran and
parsed asset changes.** No `from`, no provider, an error, or a timeout → `simulated: false`,
the unrun checks listed in `notChecked[]`, and the verdict left to the other real signals —
it **never** fabricates a clean simulation or fails open. See
[Configuration](#configuration-environment) for `TENDERLY_*` / `SIM_TIMEOUT_MS`.

> **Honest limit:** **honeypot** (sell-path) detection needs a buy→sell round-trip, which a
> single approve/transfer intent can't exercise — it is always listed in `notChecked[]`. The
> combiner still judges a honeypot the moment a future swap-simulation supplies it.

---

## Auth, rate limits & CORS

- **API keys** — send via `x-api-key` header, `Authorization: Bearer …`, or `?key=`. Valid
  keys come from the `RISK_API_KEYS` env allowlist (comma-separated). The public **`demo`**
  key is always accepted (set `DISABLE_DEMO_KEY=1` to reject it in production). Missing or
  invalid key → `401`.
- **Rate limit** — in-memory token bucket: burst of 20, refilling 1 token / 2s, per key
  (the shared `demo` key is bucketed per-IP). Over the limit → `429` with a `Retry-After`
  header.
- **CORS** — open (`*`) by default, configurable via `RISK_API_CORS_ORIGINS`
  (comma-separated origins). Preflight `OPTIONS` is answered for every endpoint.
- **Errors** — malformed input is always a `400` with a precise message (never a `500`); a
  `500` means a genuine chain/server fault and never leaks internals.
- **Logging** — one structured JSON line per request: `{ endpoint, verdict, latencyMs,
  status, address }`. No PII beyond the queried address (public on-chain data).

---

## Configuration (environment)

| Var                     | Required | Purpose                                                                                  |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `BASE_RPC_URL`          | no\*     | Base mainnet RPC. **Server-side only — never `NEXT_PUBLIC_`.** `/guard` also auto-detects `debug_traceCall` support here for the `rpc-trace` simulation provider. |
| `RISK_API_KEYS`         | no       | Comma-separated API-key allowlist.                                                       |
| `DISABLE_DEMO_KEY`      | no       | `1` to reject the public `demo` key.                                                     |
| `RISK_API_CORS_ORIGINS` | no       | Comma-separated allowed origins (default `*`).                                           |
| `TENDERLY_ACCESS_KEY`   | no       | Enables the **primary** `/guard` effect-simulation provider. **Third-party + paid** ([tenderly.co](https://tenderly.co)) — the tx is simulated on Tenderly's servers and counts against your quota. Server-side only. |
| `TENDERLY_ACCOUNT_SLUG` | no       | Tenderly account slug (required with the access key).                                    |
| `TENDERLY_PROJECT_SLUG` | no       | Tenderly project slug (required with the access key).                                    |
| `SIM_TIMEOUT_MS`        | no       | Per-simulation hard timeout (ms, default `4000`). A timeout = "did not run", never a clean sim. |

\*Falls back to the public `https://mainnet.base.org`, which rate-limits aggressively —
the ~30-day approval-log scan in `/score` is slow/flaky without a dedicated key (Alchemy /
Infura / QuickNode). Copy `.env.local.example` → `.env.local` to configure. **The RPC key
stays on the server and is never shipped to the browser.**

---

## Developer console

The app root (`/`) is a brand-carrying API doc page (Midnight theme, Sage Mark, glass): the
three endpoints with real request/response examples, copyable cURL + fetch snippets, and a
**live "try it" widget** — paste an address → calls `/api/v1/score` with the `demo` key →
renders the verdict with Guardian's VerdictRing aesthetic.

---

## Develop

```bash
npm install          # also links @chainsage/engine via file:../packages/engine
npm run dev          # http://localhost:3001
npm test             # vitest — endpoint verdict-logic + 400-not-500 + rate-limit
npm run build        # next build (typechecks)
npm run typecheck    # tsc --noEmit
```

Tests are pure where it counts: `classifySpender`, `evaluateApprove`, `evaluateTransfer`,
and `isUnlimitedAmount` are unit-tested against calibration tables (no network), and
`http.test.ts` proves the wrapper maps malformed input → `400` (not `500`), missing key →
`401`, unexpected error → `500` (no leak), and trips the rate limiter.

---

## Deploy (Vercel)

1. Import the **`risk-api`** directory as the project root (it's a standard Next.js App
   Router app). The `file:` dependency on `../packages/engine` resolves at install time, so
   deploy from the monorepo root with `risk-api` as the project's **Root Directory** and
   leave "Include source files outside of the Root Directory" enabled.
2. Set env vars in the Vercel dashboard: `BASE_RPC_URL` (a dedicated key), `RISK_API_KEYS`,
   and `DISABLE_DEMO_KEY=1` for production.
3. The API routes use the Node.js runtime (`runtime = "nodejs"`) and are `force-dynamic`
   (live reads, never cached).

---

## What's production-grade vs. what's a stub

**Production-grade**

- The verdict engine — the shared, tested `@chainsage/engine` that also powers Guardian.
- Live on-chain reads: ERC-20 approval logs with each allowance **re-read on-chain** (never
  stale), `getCode` for EOA-vs-contract, bounded contract-age sampling.
- Input validation (zod), the `{ ok, data | error }` envelope, status codes, CORS, and the
  400-not-500 guarantee.

**Scaffolded — clearly a stub**

- **API keys / auth** — an env allowlist plus a public `demo` key. No billing, no
  persistent `keys` table, no per-key scopes or quotas. The structure is in `lib/auth.ts`
  so a real key store can be dropped in.
- **Rate limiting** — in-memory token bucket in `lib/ratelimit.ts`. Per-instance, resets on
  redeploy, doesn't coordinate across instances. **Upgrade to Redis/Upstash** (a shared
  token-bucket) before scaling horizontally; the interface is intentionally small.
- **Contract age** — a public-RPC-friendly *bounded estimate* (bytecode sampling at a few
  past blocks), not an exact deployment block. With an archive RPC, upgrade
  `getContractAgeDays` to a binary search for the true deploy block.
- **Monorepo linkage** — `@chainsage/engine` ships TypeScript source consumed via
  `transpilePackages`, and carries its own `viem` (pinned to match the apps) so the `file:`
  symlink resolves cleanly. A workspace/hoisting setup would dedupe `viem`; deferred to keep
  Guardian's install untouched.

---

## Claims discipline

ChainSage is the trust layer for the agent economy, built on Virtuals — not a wallet,
not a token casino. The ACP verdict service (agents on Virtuals consulting ChainSage
before executing) is **building toward** integration — not yet live, not a partnership.
$SAGE is **launching on Virtuals via Genesis** — no supply figures, no invented mechanics.
