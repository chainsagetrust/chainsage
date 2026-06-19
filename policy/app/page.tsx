"use client";

/**
 * ChainSage Policy — the owner sets standing rules (left) and replays sample
 * agent actions against them (right). Every verdict on the bench is computed by
 * the REAL pure engine (`@chainsage/policy-engine`) in the browser; nothing is
 * mocked. The bench makes precedence tangible: DENY > REVIEW > ALLOW, with every
 * rule that fired shown and the deciding rule called out.
 *
 * Honest scope: this builds and proves a policy. Enforcing it against live agent
 * signing is the integration step described in the README — out of scope here.
 */
import { useEffect, useMemo, useState } from "react";
import { evaluate, policyToJSON, policyFromJSON } from "@chainsage/policy-engine";
import type { Policy, PolicyContext, PolicyRuleId, Decision } from "@chainsage/policy-engine";
import type { Intent } from "chainsage";
import { PolicyBuilder } from "@/components/PolicyBuilder";
import {
  DEFAULT_POLICY,
  SCENARIOS,
  intentAmount,
  shortAddr,
  type Scenario,
} from "@/lib/samples";
import { verdictColor, type Verdict } from "@/lib/tokens";
import { SageMark, Lock, Check, Alert, Ban, Arrow, Refresh, Spark, External } from "@/components/Brand";

const STORAGE_KEY = "chainsage.policy.v1";

const RULE_LABEL: Record<PolicyRuleId, string> = {
  "blocked-protocol": "Blocked protocol",
  "unlimited-approval": "Unlimited approval",
  "fresh-contract": "Fresh contract",
  "spend-per-tx": "Per-tx spend cap",
  "spend-per-day": "Per-day spend cap",
  "chain-not-allowed": "Chain not allowed",
  "protocol-not-allowlisted": "Not allow-listed",
  "low-trust": "Low trust",
};

const KIND_LABEL: Record<Intent["kind"], string> = {
  approve: "Approve",
  transfer: "Transfer",
  swap: "Swap",
  x402_pay: "x402 pay",
};

/** Live facts fetched from /api/context, keyed by scenario id. */
type LiveFacts = Record<string, { ctx: PolicyContext; verdict: Verdict; ageDays: number | null; knownGood: string | null }>;

export default function Page() {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [showJson, setShowJson] = useState(false);
  const [live, setLive] = useState<LiveFacts>({});
  const [loaded, setLoaded] = useState(false);

  // Load persisted policy (client only — keeps SSR markup deterministic).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPolicy(policyFromJSON(raw));
    } catch {
      /* corrupt storage → keep the default policy */
    }
    setLoaded(true);
  }, []);

  // Persist on change (after the initial load).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, policyToJSON(policy));
    } catch {
      /* storage unavailable (private mode) — non-fatal */
    }
  }, [policy, loaded]);

  const json = useMemo(() => policyToJSON(policy), [policy]);

  const resetPolicy = () => {
    setPolicy(DEFAULT_POLICY);
    setLive({});
  };

  return (
    <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-7 sm:px-8">
      <Header onReset={resetPolicy} />

      <div className="mt-7 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
        {/* left — builder + JSON */}
        <div className="flex flex-col gap-4">
          <PolicyBuilder policy={policy} onChange={setPolicy} />
          <JsonView json={json} open={showJson} onToggle={() => setShowJson((s) => !s)} />
        </div>

        {/* right — the test bench */}
        <TestBench policy={policy} live={live} setLive={setLive} />
      </div>

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ header */

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <SageMark size={38} />
        <div className="leading-tight">
          <div className="text-[19px] font-extrabold tracking-tightish">Policy</div>
          <div className="micro text-text-3">CHAINSAGE · PHASE 4</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 text-text-2 sm:flex">
          <Lock size={14} />
          <span className="micro">PRECEDENCE&nbsp;·&nbsp;DENY&nbsp;&gt;&nbsp;REVIEW&nbsp;&gt;&nbsp;ALLOW</span>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-full border border-card-border px-3 py-1.5 text-sm text-text-2 transition hover:border-primary hover:text-text"
        >
          <Refresh size={14} /> Reset
        </button>
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- json view */

function JsonView({ json, open, onToggle }: { json: string; open: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — non-fatal */
    }
  };
  return (
    <div className="cs-glass overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 font-semibold">
          <Spark size={16} className="text-primary" /> Policy as JSON
        </span>
        <span className="micro text-text-3">{open ? "HIDE" : "SHOW"}</span>
      </button>
      {open && (
        <div className="border-t border-hairline">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="micro text-text-3">bigint amounts encode as strings</span>
            <button onClick={copy} className="micro flex items-center gap-1 text-text-2 hover:text-primary">
              <Check size={13} /> {copied ? "COPIED" : "COPY"}
            </button>
          </div>
          <pre className="mono max-h-80 overflow-auto px-4 pb-4 text-xs leading-relaxed text-text-2">{json}</pre>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- test bench */

function TestBench({
  policy,
  live,
  setLive,
}: {
  policy: Policy;
  live: LiveFacts;
  setLive: React.Dispatch<React.SetStateAction<LiveFacts>>;
}) {
  const results = useMemo(
    () =>
      SCENARIOS.map((s) => {
        const ctx = live[s.id]?.ctx ?? s.context;
        return { scenario: s, evaluation: evaluate(s.intent, policy, ctx), usingLive: !!live[s.id] };
      }),
    [policy, live]
  );

  const tally = results.reduce(
    (acc, r) => {
      acc[r.evaluation.decision]++;
      return acc;
    },
    { ALLOW: 0, REVIEW: 0, DENY: 0 } as Record<Decision, number>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-text-2">
        <Arrow size={18} className="text-primary" />
        <h2 className="text-lg font-bold text-text">Test bench</h2>
        <span className="ml-auto flex items-center gap-2">
          <TallyPill verdict="ALLOW" n={tally.ALLOW} />
          <TallyPill verdict="REVIEW" n={tally.REVIEW} />
          <TallyPill verdict="DENY" n={tally.DENY} />
        </span>
      </div>
      <p className="-mt-2 text-sm text-text-3">
        Sample agent actions replayed against the current policy by the real engine. Edit a rule on the left and every
        verdict updates instantly.
      </p>

      <div className="flex flex-col gap-3">
        {results.map(({ scenario, evaluation, usingLive }) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            decision={evaluation.decision}
            firedRules={evaluation.firedRules}
            usingLive={usingLive}
            liveMeta={live[scenario.id]}
            onResolveLive={async () => {
              if (!scenario.counterparty) return;
              try {
                const res = await fetch(`/api/context?address=${scenario.counterparty}`);
                const body = await res.json();
                if (!body.ok) throw new Error(body.error?.message ?? "lookup failed");
                const d = body.data;
                setLive((prev) => ({
                  ...prev,
                  [scenario.id]: {
                    ctx: {
                      ...scenario.context,
                      counterpartyIsFresh: d.counterpartyIsFresh,
                      counterpartyTrust: d.counterpartyTrust,
                    },
                    verdict: d.verdict,
                    ageDays: d.ageDays,
                    knownGood: d.knownGood,
                  },
                }));
              } catch (err) {
                alert(`Could not resolve live facts: ${err instanceof Error ? err.message : "error"}`);
              }
            }}
            onClearLive={() =>
              setLive((prev) => {
                const next = { ...prev };
                delete next[scenario.id];
                return next;
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function TallyPill({ verdict, n }: { verdict: Verdict; n: number }) {
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
      style={{ borderColor: `${verdictColor[verdict]}55`, color: verdictColor[verdict] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: verdictColor[verdict] }} />
      {n}
    </span>
  );
}

function ScenarioCard({
  scenario,
  decision,
  firedRules,
  usingLive,
  liveMeta,
  onResolveLive,
  onClearLive,
}: {
  scenario: Scenario;
  decision: Decision;
  firedRules: { rule: PolicyRuleId; decision: Exclude<Decision, "ALLOW">; reason: string }[];
  usingLive: boolean;
  liveMeta?: LiveFacts[string];
  onResolveLive: () => void;
  onClearLive: () => void;
}) {
  const color = verdictColor[decision];
  const deciding = firedRules.find((r) => r.decision === "DENY") ?? firedRules.find((r) => r.decision === "REVIEW");
  const counterpartyLabel =
    scenario.intent.kind === "swap" ? "no spender (swap)" : scenario.counterparty ? shortAddr(scenario.counterparty) : "—";

  const explanation =
    decision === "ALLOW"
      ? "No rule fired — ALLOW by permissive default."
      : decision === "DENY"
        ? `DENY wins — ${RULE_LABEL[deciding!.rule]} fired.`
        : `REVIEW — ${firedRules.length} rule${firedRules.length > 1 ? "s" : ""} flagged, no DENY.`;

  return (
    <div className="cs-glass overflow-hidden" style={{ borderColor: `${color}40` }}>
      <div className="flex items-start gap-4 p-4">
        {/* verdict pill */}
        <div
          className="flex w-[88px] shrink-0 flex-col items-center gap-1 rounded-cs border py-3"
          style={{ borderColor: `${color}55`, background: `${color}12` }}
        >
          <span className="micro" style={{ color }}>
            VERDICT
          </span>
          <span className="text-lg font-extrabold tracking-tightish" style={{ color }}>
            {decision}
          </span>
        </div>

        {/* body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="micro rounded border border-card-border px-1.5 py-0.5 text-text-3">
              {KIND_LABEL[scenario.intent.kind]}
            </span>
            <h3 className="font-semibold">{scenario.title}</h3>
            {usingLive && (
              <span className="micro inline-flex items-center gap-1 rounded-full border border-primary/50 px-2 py-0.5 text-primary">
                LIVE
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-text-2">{scenario.blurb}</p>

          {/* intent summary */}
          <div className="mono mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-3">
            <span className="text-text-2">{intentAmount(scenario.intent)}</span>
            <Arrow size={12} />
            <span title={scenario.counterparty ?? undefined}>{counterpartyLabel}</span>
            <span className="text-text-3">· chain {scenario.intent.chain}</span>
          </div>

          {/* precedence explanation */}
          <div className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color }}>
            {decision === "DENY" ? <Ban size={15} /> : decision === "REVIEW" ? <Alert size={15} /> : <Check size={15} />}
            {explanation}
          </div>

          {/* fired rules */}
          {firedRules.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {firedRules.map((r, i) => {
                const rc = verdictColor[r.decision];
                return (
                  <li key={`${r.rule}-${i}`} className="flex items-start gap-2 text-xs">
                    <span
                      className="mono mt-0.5 shrink-0 rounded px-1.5 py-0.5"
                      style={{ background: `${rc}1c`, color: rc }}
                    >
                      {r.decision} · {RULE_LABEL[r.rule]}
                    </span>
                    <span className="text-text-2">{r.reason}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* facts footnote + live control */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-3 text-xs text-text-3">
            <Facts scenario={scenario} usingLive={usingLive} liveMeta={liveMeta} />
            <span className="ml-auto flex items-center gap-2">
              {scenario.counterparty &&
                (usingLive ? (
                  <button onClick={onClearLive} className="hover:text-primary">
                    use sample facts
                  </button>
                ) : (
                  <button onClick={onResolveLive} className="inline-flex items-center gap-1 hover:text-primary">
                    <External size={12} /> resolve live facts
                  </button>
                ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Facts({
  scenario,
  usingLive,
  liveMeta,
}: {
  scenario: Scenario;
  usingLive: boolean;
  liveMeta?: LiveFacts[string];
}) {
  const ctx = usingLive ? liveMeta?.ctx ?? scenario.context : scenario.context;
  const parts: string[] = [];
  if (ctx.counterpartyIsFresh !== undefined) parts.push(`fresh=${ctx.counterpartyIsFresh}`);
  if (ctx.counterpartyTrust !== undefined) parts.push(`trust=${ctx.counterpartyTrust.toFixed(2)}`);
  if (ctx.spentTodayByToken) {
    const total = Object.values(ctx.spentTodayByToken).reduce((a, b) => a + b, 0n);
    if (total > 0n) parts.push(`spent-today set`);
  }
  return (
    <span className="mono">
      {usingLive ? "LIVE FACTS" : "SAMPLE FACTS"}
      {parts.length > 0 ? ` · ${parts.join(" · ")}` : " · none"}
      {usingLive && liveMeta?.ageDays != null && ` · age≈${liveMeta.ageDays}d`}
    </span>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-1 border-t border-hairline pt-6 text-center text-xs text-text-3">
      <div className="flex items-center gap-2">
        <SageMark size={18} />
        <span>ChainSage Policy — owner-defined rules, enforced deterministically.</span>
      </div>
      <span className="mono">
        Pure engine · precedence proven by test · enforcement against live signing is integration work (see README)
      </span>
    </footer>
  );
}
