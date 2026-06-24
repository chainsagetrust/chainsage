# ChainSage

**The trust layer for autonomous finance** — the decision engine between an AI
agent's intent and on-chain execution.

> Settlement moves money. Authorization grants permission.
> **ChainSage decides whether it should happen.**
>
> Agent Intent → ChainSage Verdict (ALLOW / REVIEW / DENY) → Execution.

`chainsage.finance` · [@chainsagetrust](https://x.com/chainsagetrust) ·
[github.com/chainsagetrust/chainsage](https://github.com/chainsagetrust/chainsage)

---

## Runnable deliverables

| Folder | What it is | Run |
|---|---|---|
| [`brand/`](./brand) | The brand system — design tokens (CSS + Tailwind), the Sage Mark, full asset set (logo lockup, app icon, avatar, X banner, hero + roadmap art) with PNG fallbacks, and [`BRAND-GUIDE.md`](./brand/BRAND-GUIDE.md). | `cd brand/assets && npm i sharp && node render-png.mjs` |
| [`packages/engine/`](./packages/engine) | **Shared verdict engine — the single source of truth.** `chain.ts` (live Base reads) + `risk.ts` (the tested verdict engine, 11 calibration tests) + `classify.ts`/`simulate.ts`. Guardian, the Risk API, and the SDK all depend on it; no second copy exists. | `cd packages/engine && npx vitest run` |
| [`guardian/`](./guardian) | **Phase-1 product — REAL.** A Next.js app that reads live Base mainnet state (balances, approvals, contract ages) and returns a verdict. No mock data. | `cd guardian && npm i && npm run dev` |
| [`risk-api/`](./risk-api) | **Phase-2 product — REAL.** The verdict engine as an embeddable HTTP API (`/api/v1/score \| classify \| simulate`) plus a developer console. Same engine as Guardian. | `cd risk-api && npm i && npm run dev` |
| [`packages/chainsage-sdk/`](./packages/chainsage-sdk) | **Phase-3 product — REAL.** The `chainsage` npm SDK: `cs.check(intent)` / `cs.guard()` returns ALLOW/REVIEW/DENY before an agent signs. Fail-safe (never ALLOW on error), api or local mode, ships ESM+types. | `cd packages/chainsage-sdk && npm i && npm test` |
| [`sdk-demo/`](./sdk-demo) | **Phase-3 demo — REAL.** Interactive page: an autonomous agent gated by `chainsage.check()` across four scenarios, visibly blocked on DENY. Live verdicts on Base. | `cd sdk-demo && npm i && npm run dev` |
| [`site/`](./site) | The dual-theme (Midnight ⇄ Aurora) marketing site — 11 sections, animated verdict engine, interactive agent demo, and a live trust-network graph. | `cd site && npm i && npm run dev` |

Each project builds and typechecks clean independently.

---

## The five-phase thesis

1. **Guardian** — consumer wallet protection + transaction intelligence *(built, in `guardian/`)*.
2. **Risk API** — the verdict engine as embeddable infrastructure *(built, in `risk-api/`)*.
3. **Agent SDK** — `chainsage.check(intent)` before every signature *(built, in `packages/chainsage-sdk/` + `sdk-demo/`)*.
4. **Policy Engine** — runtime rules for autonomous agents.
5. **Trust Network** — shared reputation; the network-effect moat.

---

## Brand inheritance

`brand/tokens.css` (CSS variables for the Midnight + Aurora themes) and
`brand/tokens.ts` (Tailwind theme fragment + `verdictColor` helper) are the single
source of truth for design. Each app carries a copy and inherits the same Sage Mark,
glass surfaces, typography (Hanken Grotesk + JetBrains Mono), and the **sacred semantic
rule**: `trust` / `warning` / `danger` are reserved exclusively for verdict and
risk state (ALLOW / REVIEW / DENY) — never decorative.

The **verdict engine** is shared, not copied: `packages/engine` (`@chainsage/engine`)
is the one source of truth for the scoring logic and on-chain reads — including the
`classify` / `simulate` decision functions. Guardian's `lib/chain.ts` / `lib/risk.ts`
and the Risk API's `lib/classify.ts` / `lib/simulate.ts` are thin re-export shims over
it; the SDK bundles it. No second copy of any verdict logic exists.

## Honest status

- **Virtuals / ACP**: ChainSage is *building toward* an ACP verdict service that
  agents on Virtuals call before executing — in progress, not yet live, and not a
  claimed partnership.
- **$SAGE**: *launching on Virtuals via Genesis* — no supply figures or mechanics claimed.
- **Guardian**: live and real against Base mainnet today.
