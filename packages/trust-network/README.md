# @chainsage/trust-network

Pure, deterministic reputation engine — the computational foundation of
ChainSage's trust network. Computes a propagated trust score per entity from its
own signal history **plus** bounded, decaying trust from connected entities.

```ts
import { computeAllTrust, reportIncident, verdictToSignal } from "@chainsage/trust-network";

const scores = computeAllTrust(graph);                            // TrustScore per entity
const after  = computeAllTrust(reportIncident(contract, graph));  // collapse + propagate
const signal = verdictToSignal(verdict, observer, "drained");     // Phase 1–4 → network
```

> **Scope honesty lives in the app README** (`../../trust-network/README.md`): this
> is a real, tested *engine* — not a network that already has the scale or
> neutrality of a standard. Read it.

## The model

- `Entity` — agent / contract / protocol / wallet, identified by `Address` (reused
  from the SDK; one definition across ChainSage).
- `Signal` — `from` → `about`, a `verdict_outcome` | `attestation` | `incident`,
  with `weight ≥ 0` and `value ∈ [-1,1]`.
- `TrustScore` — `score ∈ [0,1]` (0.5 = neutral/unknown), `confidence ∈ [0,1]`,
  and the count of independent `contributors`.

## Determinism & boundedness (tested)

Score = **direct** (own signals, with a neutral prior + anti-gaming caps) blended
with a **propagated** part: the affine iteration `s ← (1-α)·d + α·P·s` where `P`
is a row-stochastic neighbour-weight matrix and `α < 1`. That is a contraction
with a unique fixed point in `[0,1]`, run for a fixed capped number of iterations
— so the same graph always yields the same scores, with no runaway or oscillation.
Incident nodes are clamped every iteration, so a drainer can't be rehabilitated by
the trust of its victims.

## Anti-gaming (partial — by design)

Mitigated: self-attestation (capped weight + neutral prior), single-source spam
(per-source cap), untrusted voters (influence scales with the voter's own score),
over-claimed confidence (tracks independent contributors). **Not solved:** sybil
clusters of funded/aged/mutually-attesting addresses, wash-trust, cold-start,
signal authenticity. These are named in code comments and the app README — a trust
system that hid them would be the opposite of trustworthy.

## Scripts

```bash
npm test         # determinism, bounded propagation, incident decay, confidence, self-cap
npm run typecheck
```
