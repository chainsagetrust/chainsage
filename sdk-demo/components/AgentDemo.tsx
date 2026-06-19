"use client";

import { useState } from "react";
import { SCENARIOS, type ScenarioMeta } from "@/lib/scenarios";
import { Pipeline, STAGES } from "./Pipeline";
import { VerdictPill, ScoreDial, type Decision } from "./Verdict";
import { Bot, Play, Spark, CheckC, Ban, Hand } from "./Brand";
import { verdictColor } from "@/lib/tokens";

interface VerdictView {
  decision: Decision;
  score: number;
  reasons: string[];
  verdictId: string;
  notChecked: string[];
  experimental: boolean;
  source: string;
  failSafe: boolean;
}
type Outcome = "executed" | "held" | "blocked";
interface CheckResponse {
  ok: boolean;
  verdict?: VerdictView;
  outcome?: Outcome;
  error?: string;
}

interface RunState {
  status: "idle" | "running" | "done" | "error";
  stage: number;
  verdict?: VerdictView;
  outcome?: Outcome;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AgentDemo() {
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [busy, setBusy] = useState(false);

  const set = (id: string, s: Partial<RunState>) =>
    setRuns((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { status: "idle", stage: -1 }), ...s } }));

  async function run(id: string) {
    const pace = reduced() ? 0 : 1;
    set(id, { status: "running", stage: 0, verdict: undefined, outcome: undefined, error: undefined });
    await sleep(350 * pace);
    set(id, { stage: 1 });
    await sleep(400 * pace);
    set(id, { stage: 2 }); // Risk engine — the real on-chain work happens here

    let data: CheckResponse | null = null;
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: id }),
      });
      data = (await res.json()) as CheckResponse;
    } catch {
      set(id, { status: "error", error: "Could not reach the verdict service." });
      return;
    }

    set(id, { stage: 3 });
    await sleep(260 * pace);
    set(id, { stage: 4 });
    await sleep(260 * pace);
    set(id, { stage: STAGES.length - 1 });

    if (data?.ok && data.verdict) {
      set(id, { status: "done", verdict: data.verdict, outcome: data.outcome });
    } else {
      set(id, { status: "error", error: data?.error ?? "Unknown error." });
    }
  }

  async function runAll() {
    setBusy(true);
    for (const s of SCENARIOS) {
      await run(s.id);
      await sleep(reduced() ? 0 : 500);
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={runAll}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-cs bg-brand px-5 py-3 text-sm font-semibold text-white transition-transform ease-spring hover:scale-[1.02] disabled:opacity-60"
        >
          {busy ? <Spark size={18} className="cs-spin" /> : <Play size={18} />}
          {busy ? "Agent running…" : "Run the agent"}
        </button>
        <span className="mono text-xs text-text-3">
          4 actions · each gated by <span className="text-text-2">cs.guard()</span> before signing
        </span>
      </div>

      <div className="space-y-4">
        {SCENARIOS.map((s) => (
          <ScenarioCard key={s.id} meta={s} state={runs[s.id]} onRun={() => run(s.id)} disabled={busy} />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  meta,
  state,
  onRun,
  disabled,
}: {
  meta: ScenarioMeta;
  state?: RunState;
  onRun: () => void;
  disabled: boolean;
}) {
  const st = state ?? { status: "idle" as const, stage: -1 };
  const running = st.status === "running";
  const done = st.status === "done" && st.verdict;

  return (
    <div className="cs-glass overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="mono grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline text-sm text-text-2">
            {meta.step}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-text-3" />
              <h3 className="font-semibold tracking-tightish text-text">{meta.title}</h3>
              {meta.experimental && (
                <span className="mono rounded-full border border-hairline px-2 py-0.5 text-[10px] text-[var(--cyan)]">
                  forward-looking
                </span>
              )}
            </div>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-2">{meta.narrative}</p>
            <code className="mono mt-2 inline-block rounded bg-[var(--bg-2)] px-2 py-1 text-[12px] text-text-2">
              {meta.intentSummary}
            </code>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={disabled || running}
          className="inline-flex shrink-0 items-center gap-2 rounded-cs border border-hairline px-4 py-2 text-sm text-text transition-colors hover:border-[var(--primary)] disabled:opacity-50"
        >
          {running ? <Spark size={15} className="cs-spin" /> : <Play size={15} />}
          {running ? "Checking…" : done ? "Re-run" : "Attempt"}
        </button>
      </div>

      {st.stage >= 0 && (
        <div className="mt-5 border-t border-hairline pt-4">
          <Pipeline activeIndex={st.stage} decision={done ? st.verdict!.decision : undefined} />
        </div>
      )}

      {st.status === "error" && (
        <div
          className="mt-4 rounded-cs border px-4 py-3 text-sm"
          style={{ borderColor: "var(--warning)", color: "var(--warning)", background: "rgba(251,191,36,0.08)" }}
        >
          {st.error}
        </div>
      )}

      {done && <Result meta={meta} verdict={st.verdict!} outcome={st.outcome!} />}
    </div>
  );
}

function Result({ meta, verdict, outcome }: { meta: ScenarioMeta; verdict: VerdictView; outcome: Outcome }) {
  return (
    <div className="mt-5 cs-fade-up">
      <OutcomeBanner outcome={outcome} verdict={verdict} executeLabel={meta.executeLabel} />

      <div className="mt-4 flex flex-col gap-5 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <ScoreDial score={verdict.score} decision={verdict.decision} />
          <VerdictPill decision={verdict.decision} />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <div className="micro mb-1 text-text-3">why · each maps to a real check</div>
            <ul className="space-y-1.5">
              {verdict.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-text-2">
                  <span
                    className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                    style={{ background: verdictColor[verdict.decision] }}
                  />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="micro mb-1 text-text-3">not checked · no fabricated checks</div>
            <ul className="space-y-1">
              {verdict.notChecked.map((n, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-text-3">
                  — {n}
                </li>
              ))}
            </ul>
          </div>
          <div className="mono flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-2 text-[11px] text-text-3">
            <span>id {verdict.verdictId.slice(0, 16)}…</span>
            <span>source {verdict.source}</span>
            {verdict.experimental && <span className="text-[var(--cyan)]">experimental</span>}
            {verdict.failSafe && <span className="text-[var(--warning)]">fail-safe</span>}
          </div>
          {meta.realNote && <p className="text-[12px] leading-relaxed text-text-3">✓ real: {meta.realNote}</p>}
          {meta.simNote && <p className="text-[12px] leading-relaxed text-text-3">◌ simulated: {meta.simNote}</p>}
        </div>
      </div>
    </div>
  );
}

function OutcomeBanner({
  outcome,
  verdict,
  executeLabel,
}: {
  outcome: Outcome;
  verdict: VerdictView;
  executeLabel?: string;
}) {
  if (outcome === "blocked") {
    return (
      <div
        className="flex items-center gap-3 rounded-cs px-4 py-3"
        style={{ background: "rgba(244,83,79,0.12)", border: "1px solid rgba(244,83,79,0.5)" }}
      >
        <Ban size={22} style={{ color: "var(--danger)" }} />
        <div>
          <div className="font-bold" style={{ color: "var(--danger)" }}>
            BLOCKED — the agent halted.
          </div>
          <div className="mono text-[12px] text-text-2">
            cs.guard() threw ChainSageDenied. Nothing was signed.
          </div>
        </div>
      </div>
    );
  }
  if (outcome === "held") {
    return (
      <div
        className="flex items-center gap-3 rounded-cs px-4 py-3"
        style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.45)" }}
      >
        <Hand size={20} style={{ color: "var(--warning)" }} />
        <div>
          <div className="font-bold" style={{ color: "var(--warning)" }}>
            HELD FOR HUMAN
          </div>
          <div className="mono text-[12px] text-text-2">
            cs.guard() threw ChainSageReview — awaiting approval before signing.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-3 rounded-cs px-4 py-3"
      style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.45)" }}
    >
      <CheckC size={20} style={{ color: "var(--trust)" }} />
      <div>
        <div className="font-bold" style={{ color: "var(--trust)" }}>
          EXECUTED
        </div>
        <div className="mono text-[12px] text-text-2">
          {executeLabel ?? "cs.guard() allowed the action — executed (simulated)."}
        </div>
      </div>
    </div>
  );
}
