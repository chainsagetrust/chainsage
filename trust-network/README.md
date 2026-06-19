# ChainSage Trust Network — Phase 5

## ⚠️ Read this first — the honest scope

This is the **foundation** of a trust network: a real, tested reputation engine, a
real signal-ingestion path, and an engine-driven visualization grounded in real
Base entities where labelled. It is **not** — and this page will never imply it is
— the *default trust standard for autonomous finance*.

A trust network that actually becomes an industry standard requires things you
cannot build in a sprint and we have not pretended to: **a corpus of real
decision-outcome data, many independent participants contributing signals,
sybil/gaming resistance hardened against real adversaries, and genuine network
effects that only form with adoption and time.** Those are earned, not declared.

What is **real and production-grade here:**
- The reputation engine (`@chainsage/trust-network`) — pure, deterministic,
  exhaustively tested (determinism, bounded propagation, incident decay,
  confidence scaling, self-attestation cap).
- The incident-propagation behaviour — the demo's "Simulate Drainer Incident"
  runs the **actual** `reportIncident` + `computeAllTrust`; the scores you see are
  recomputed, not animated.
- The signal write-path (`/api/signals`) — a working bridge from a Phase 1–4
  verdict to a network `Signal`, persisted to a store.
- The real Base addresses in the graph (Uniswap routers, Permit2, USDC, WETH) —
  the same ones on Guardian's known-good allowlist, labelled `REAL · BASE`.

What is **foundational / seeded:**
- The fictional agents, wallets, and the "Fresh Contract" drainer are **seed**
  nodes for demo density, labelled `SEED` in the UI. They are not live network
  participants.
- The seed signals are illustrative. **Real signal volume requires real usage.**

## Deliverable A — the reputation engine (`packages/trust-network`)

```ts
import { computeAllTrust, reportIncident } from "@chainsage/trust-network";

const scores = computeAllTrust(graph);                       // TrustScore per entity
const after  = computeAllTrust(reportIncident(contract, graph)); // collapse + propagate
```

A trust score has two parts: a **direct** score from the entity's own signals, and
a **propagated** part — a bounded, decaying spread of trust across graph edges
(PageRank-style), so a trusted neighbourhood lifts an entity and a drained
neighbour drags it down (**negative propagation**).

**Determinism + boundedness (tested).** Propagation is the affine iteration
`s ← (1-α)·d + α·P·s` with `P` row-stochastic and `α < 1` — a contraction with a
unique fixed point in `[0,1]`. We run a fixed, capped number of iterations: same
graph → same scores, no runaway, no oscillation.

**Incident decay (tested).** `reportIncident(C)` makes C's score collapse (clamped,
and held collapsed so victims can't rehabilitate it), drags direct neighbours
down, affects distant nodes less, and leaves unconnected nodes untouched.

```bash
npm test --prefix packages/trust-network   # 13 tests — the gate that matters
```

### Anti-gaming — what's mitigated vs. what's NOT (the most important section)

A trust system that hides its attack surface is the opposite of trustworthy.

**Partially mitigated in this engine:**
- **Self-attestation** — a self-signal's weight is capped *and* a neutral prior
  pulls low-evidence scores toward 0.5, so you cannot self-vouch to high trust.
- **Single-source spam** — per-source weight is capped; one loud source can't
  out-shout the rest.
- **Untrusted voters** — a source's influence scales with its *own* score, so a
  cloud of brand-new (neutral) addresses counts for little.
- **Over-claimed confidence** — confidence tracks *independent contributors* and
  is shown honestly; thin evidence never reads as high confidence.

**NOT solved here (named, open problems):**
- **Sybil clusters** of many *funded, aged, mutually-attesting* addresses can still
  manufacture reputation. Real defences (stake, proof-of-personhood, graph-anomaly
  detection) are out of scope.
- **Wash-trust / collusion rings** that trade attestations.
- **Cold-start** — new honest entities look the same as unknown ones (neutral, low
  confidence); the prior that resists gaming also penalises newcomers.
- **Signal authenticity** — the store trusts what's posted. There is no proof that
  an attested outcome actually happened on-chain, nor an authenticated reporter set.

These are exactly the problems that adoption, real data, and further engineering
must close before this could be called a standard.

## Deliverable B — the visualization (`trust-network` Next.js app)

```bash
npm install --prefix packages/trust-network
npm install --prefix trust-network
npm run dev --prefix trust-network     # http://localhost:3003
npm run build --prefix trust-network   # green
```

Clickable nodes open a side panel (score, confidence, contributors, the signals
about the entity). **Simulate Drainer Incident** calls the real engine, animates
the collapse + red ripple + a live signal feed of the real score diffs, and shows
how many entities the network would now flag to agents. Node colour uses the
sacred verdict palette (trust / warning / danger) because a trust score *is* risk
state.

## Deliverable C — the signal ingestion path

A verdict from Phases 1–4 becomes a network signal:

```
Guardian / SDK / Policy verdict ──▶ verdictToSignal(verdict, observer, outcome)
                                  ──▶ POST /api/signals ──▶ store (.data/signals.json)
                                  ──▶ graph merges it ──▶ computeAllTrust recomputes
```

- `verdictToSignal` (pure, in the engine package) maps a `Verdict` + observed
  outcome to a `Signal` about the intent's counterparty. A confirmed *drained*
  outcome is an `incident`; a *safe* outcome is a positive `verdict_outcome`; with
  no observed outcome it emits a weaker prediction-only signal — because a
  prediction is weaker evidence than an outcome.
- The store is the simplest thing that works (a JSON file). Swap it for
  SQLite/Upstash/Postgres in production; the interface is the only contract.
- The "Ingest a verdict outcome" button exercises this exact path end-to-end.

## Roadmap to real network effects (honest)

1. **Real outcome data** — wire Guardian/SDK verdicts + observed on-chain outcomes
   (did the flagged spender actually drain?) into the store at volume.
2. **Authenticated, independent reporters** — replace the single incident-reporter
   sentinel with a set of stake-weighted, authenticated signers.
3. **Sybil/collusion resistance** — graph-anomaly detection, stake, identity.
4. **Multi-party participation** — other tools writing and reading signals; that is
   what creates the network effect and the moat.
5. **Neutrality & governance** — a standard cannot be owned. Becoming one is a
   social and adoption problem as much as a technical one.

The engine is built right and proven by test. The moat is earned through adoption
— and this README says so plainly.
