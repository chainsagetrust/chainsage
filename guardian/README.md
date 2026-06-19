# ChainSage Guardian

**Phase 1 of ChainSage — the trust layer for autonomous finance.**

Guardian reads any wallet **live on Base mainnet** — token balances, ERC-20
approvals, unlimited allowances, and the deployed age of every spender contract —
and returns a single verdict: **ALLOW · REVIEW · DENY**, with a health score and
an actionable list of what it found.

> Read-only by default. Guardian never requests a signature and never moves
> funds. To revoke an approval, it links you to Basescan.

**No mock data.** Every number on screen is read from the chain in `lib/chain.ts`.

---

## Quick start

```bash
npm install
cp .env.local.example .env.local   # then paste an RPC URL (recommended)
npm run dev                         # http://localhost:3000
```

Connect a wallet (read-only) **or** paste any `0x…` address to scan it.

### RPC note (important)

The default RPC is the public `https://mainnet.base.org`. It works but
rate-limits aggressively, which makes the ~30-day `Approval` log scan slow or
flaky. **A dedicated key (Alchemy / Infura / QuickNode) is strongly recommended**
— set it in `.env.local`:

```
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<your-key>
```

`scanApprovals` automatically falls back to progressively smaller block windows
if the RPC caps the `getLogs` range, so it degrades gracefully on the public node.

---

## How the verdict is built

| File | Responsibility |
|---|---|
| `lib/chain.ts` | Live Base reads — balances, `scanApprovals` (re-reads each allowance on-chain so nothing is stale), `getContractAgeDays` (bytecode sampling to bound spender age). |
| `lib/risk.ts` | **Pure, tested** verdict engine. Starts at 100, deducts only for concrete on-chain risk; every deduction maps to one actionable flag. |
| `components/useGuardianScan.ts` | Orchestrates the reads into a `Report` through staged scanning states. |
| `components/VerdictRing.tsx` | Animated health-score dial, colored by verdict. |
| `app/page.tsx` | Connect → scan → verdict screen. |

### Risk weights

- Unlimited approvals: −min(40, n·12) — REVIEW (DENY at n≥3).
- Approvals to **fresh** contracts (< 7 days old): −min(55, n·30) — DENY. *Weighted heavily — the strongest drainer signal.*
- **Compounding overlap** (unlimited **and** fresh — the textbook drainer): extra −min(25, n·25) — forces DENY.
- Large approval surface (>8): −min(12, (n−8)·2) — REVIEW.
- Single-asset concentration: −4 — informational only.
- `scoreToVerdict`: ≥75 ALLOW · ≥45 REVIEW · else DENY. Overall verdict is the worst of the score-derived verdict and any flag escalation.

---

## Quality

```bash
npm test            # vitest — risk-engine calibration table (11 tests)
npx tsc --noEmit    # strict typecheck, clean
npm run build       # next build, succeeds
```

The calibration table that `lib/risk.test.ts` asserts:

| scenario | score → verdict |
|---|---|
| clean wallet | 100 → ALLOW |
| 1 unlimited (established) | 88 → ALLOW |
| 3 unlimited | 64 → REVIEW |
| 1 fresh-contract approval | 70 → REVIEW |
| **unlimited + fresh (drainer)** | **→ DENY** |

---

## Deploy (Vercel)

1. Push this folder to a repo.
2. Import it in Vercel (framework auto-detected as Next.js).
3. Set `NEXT_PUBLIC_BASE_RPC_URL` in the project's Environment Variables.
4. Deploy.

---

## Stack

Next.js (App Router) · TypeScript (strict) · wagmi · viem · @tanstack/react-query ·
Tailwind. Read-only connectors: injected + Coinbase Wallet. Midnight brand theme,
shared with the rest of ChainSage via `lib/tokens.ts` + `app/tokens.css`.
