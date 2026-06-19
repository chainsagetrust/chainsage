# @chainsage/policy-engine

Owner-defined rules, evaluated deterministically. Given an `Intent` (the SDK's
type — there is **no parallel definition**), an owner's `Policy`, and a
`PolicyContext` of facts, the engine returns **ALLOW / REVIEW / DENY** plus
**every rule that fired**.

```ts
import { evaluate } from "@chainsage/policy-engine";

const { decision, firedRules } = evaluate(intent, policy, context);
// decision: "ALLOW" | "REVIEW" | "DENY"
// firedRules: the REVIEW/DENY rules that triggered, in deterministic order
```

This is where ChainSage stops only *advising* and starts *enforcing*: the trust
layer (Phases 1–3) decides whether an action is **safe**; the policy engine
decides whether the owner **authorized** it — so a person can delegate to an
agent without a human approval gate on every action.

## Precedence is the whole point

**DENY > REVIEW > ALLOW, absolutely.** A single DENY overrides any number of
co-occurring REVIEWs and ALLOWs. This is correct by construction: the decision is
the worst-ranked decision among the rules that fired (`firedRules`), defaulting
to ALLOW when none fired. It is proven exhaustively in `evaluate.test.ts` (26
tests): each rule fires on its trigger and only its trigger; every DENY×REVIEW
co-occurrence resolves correctly; spend-limit math is verified at the boundary
and across the unlimited case; and identical inputs always yield identical output.

```
blocked-protocol .......... counterparty on denylist               → DENY
unlimited-approval ........ unlimited approve & allowUnlimited=false → DENY
fresh-contract ............ fresh counterparty & policy "deny"      → DENY
                                              & policy "review"     → REVIEW
spend-per-tx .............. amount > maxPerTx for the token         → DENY
spend-per-day ............. spentToday + amount > maxPerDay         → DENY
chain-not-allowed ......... chain not in allowedChains              → DENY
protocol-not-allowlisted .. counterparty not in allowedProtocols    → REVIEW
low-trust ................. counterpartyTrust < trustThreshold      → REVIEW
(nothing fired) ........................................            → ALLOW
```

## Design choices (deliberate and documented)

- **Pure, no I/O.** The engine never fetches. The caller supplies `PolicyContext`
  facts (counterparty freshness, a 0–1 trust score, today's spend per token),
  computed via Guardian's on-chain reads (`@chainsage/engine`). This keeps the
  engine fast, fully testable, and deterministic.
- **Empty policy → ALLOW.** Every `Policy` field is optional; absent or empty
  fields impose no constraint. A policy only ever *adds* restrictions. (Empty
  arrays mean "no constraint", not "allow nothing".)
- **Facts that are absent don't fire rules.** Unknown freshness or trust does not
  auto-escalate — the engine never invents a fact. The caller is responsible for
  supplying the facts a rule needs.
- **Intent-kind honesty.** A swap intent carries no router/spender, so its
  counterparty is `null` and the protocol/trust/fresh rules cannot fire on it —
  only its `amountIn`/`tokenIn` spend cap applies. An `x402_pay` is a native-value
  payment with no token contract, so token-keyed spend caps cannot match it.

## Scripts

```bash
npm test        # the exhaustive precedence suite (the heart of the deliverable)
npm run typecheck
```

## Scope honesty

This package is a **correct, tested rule engine**. It decides; it does not sign.
Enforcing a verdict against an agent's **live signing path** (gating
`ChainSage.guard()` in the Phase-3 SDK) is integration work beyond this phase.
See the app README for the full statement.
