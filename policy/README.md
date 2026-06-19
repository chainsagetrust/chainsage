# ChainSage Policy — Phase 4

**Owner-defined rules, enforced deterministically.** Phase 4 is where ChainSage
stops only advising and starts *enforcing*: an owner sets standing rules once, and
an agent can act within them **without a human approval gate on every action**.

It ships three things:

1. **A pure rule engine** — [`@chainsage/policy-engine`](../packages/policy-engine).
   `evaluate(intent, policy, context)` → ALLOW / REVIEW / DENY, with every rule
   that fired. Precedence is absolute (**DENY > REVIEW > ALLOW**) and proven
   exhaustively by test.
2. **A visual policy builder** (this app) — a premium owner-facing UI where every
   control maps 1:1 to a field of the engine's `Policy`. Shown as both a friendly
   form and a readable JSON view, persisted to `localStorage`.
3. **A test bench** (this app) — replay sample agent actions (an unlimited
   approval, an oversized swap, a payment to a fresh contract, a routine
   transfer, a blocked-drainer approval…) against the **current** policy and see
   the verdict plus the exact rules that fired, with the deciding rule called out
   (*"DENY wins — Blocked protocol fired."*). Every verdict is computed by the
   **real engine** in the browser; nothing is mocked.

## Run it

```bash
# from repo root, install the workspaces (engine, sdk, policy-engine, this app)
npm install --prefix packages/policy-engine
npm install --prefix policy

npm run dev --prefix policy      # http://localhost:3002
npm run build --prefix policy    # production build (green)
```

The engine's own suite is the gate that matters:

```bash
npm test --prefix packages/policy-engine    # 26 precedence tests
```

## How it fits together

```
Agent Intent ──▶ ChainSage Policy.evaluate(intent, policy, context) ──▶ ALLOW / REVIEW / DENY
                                            ▲
                                            │ context facts (freshness, trust 0–1, spend-so-far)
                                            └── supplied by the caller, computed via Guardian's
                                                live Base reads (@chainsage/engine)
```

- The engine is **pure** — it takes facts as input and does no I/O. That is what
  makes it fast and exhaustively testable.
- The app supplies context. The bench ships **hand-authored sample facts** (clearly
  labelled) so it is instant and deterministic; each scenario can also **resolve
  live facts** for its counterparty via `/api/context`, which uses the shared
  `@chainsage/engine` reads (RPC stays server-side) to compute real contract
  freshness and a derived trust score.
- The `Intent` type is **reused** from the Phase-3 SDK (`chainsage`) — there is no
  parallel definition. The shared verdict/read engine is reused from
  `@chainsage/engine`.

## Precedence guarantee

DENY > REVIEW > ALLOW, deterministically. A single DENY rule overrides any number
of REVIEWs and ALLOWs. The engine returns **every** fired rule (not just the
deciding one) so the bench can explain a verdict in full. See
[`packages/policy-engine`](../packages/policy-engine) for the rule catalogue and
the truth-table test suite.

## ⚠️ Honest scope of this phase

This is a **correct, tested policy engine + a visual builder + a replay bench**.
It is **not** a claim that ChainSage is securing live funds in production.

- The engine decides; it does not sign. The bench replays *sample* actions and the
  live-facts path *reads* the chain — neither moves funds or touches keys.
- Enforcing a policy verdict against an agent's **live signing path** requires
  wiring `evaluate()` into the agent's execution gate — the Phase-3 SDK's
  `ChainSage.guard(intent, execute)`, so `execute()` runs only when the policy (and
  the trust verdict) returns ALLOW. That integration is **out of scope for this
  phase** and deliberately not implemented here.
- Policies persist to `localStorage` for the demo. Production would store them
  server-side, per owner, signed/versioned.

Build the engine right, prove precedence by test, *then* make it tangible — which
is exactly the order this phase was built in.
