"use client";

/**
 * ChainSage Trust Network — the interactive visualization (Deliverable B).
 *
 * Every score on screen is computed by the REAL engine (@chainsage/trust-network)
 * in the browser. "Simulate Drainer Incident" calls the real `reportIncident` +
 * `computeAllTrust` and renders the actual recomputed scores — it is NOT a
 * hardcoded animation. The red ripple is decoration on top of real numbers.
 *
 * Honest scope (see README): real engine + real Base entities where labelled +
 * a seed layer for density. This is the FOUNDATION of a trust network, not a
 * network that already has the scale or neutrality of a standard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeAllTrust,
  reportIncident,
  lc,
  type Signal,
  type TrustScore,
} from "@chainsage/trust-network";
import {
  NODES,
  SIGNALS,
  POSITIONS,
  VIEWBOX,
  DRAINER,
  AGENT_ALPHA,
  SWAP_ROUTER_02,
  USDC,
  WALLET_1,
  buildGraph,
  type SeedNode,
} from "@/lib/seed";
import { chainsageColors } from "@/lib/tokens";
import { SageMark, Alert, Ban, CheckC, Spark, Refresh, Lock, Arrow, External } from "@/components/Brand";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";

const WARN_THRESHOLD = 0.4;

function bandOf(score: number): { label: string; color: string } {
  if (score >= 0.66) return { label: "Trusted", color: chainsageColors.trust };
  if (score >= WARN_THRESHOLD) return { label: "Caution", color: chainsageColors.warning };
  return { label: "Untrusted", color: chainsageColors.danger };
}

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;
const radiusByKind: Record<SeedNode["kind"], number> = { protocol: 22, contract: 20, agent: 18, wallet: 16 };

interface FeedEntry {
  id: string;
  label: string;
  pre: number;
  post: number;
  kind: "incident" | "downgrade" | "ingest";
}

export default function Page() {
  const [ingested, setIngested] = useState<Signal[]>([]);
  const [incidentActive, setIncidentActive] = useState(false);
  const [selected, setSelected] = useState<string | null>(DRAINER.toLowerCase());
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Load any previously-ingested signals from the store (Deliverable C).
  useEffect(() => {
    fetch("/api/signals")
      .then((r) => r.json())
      .then((b) => b.ok && setIngested(b.data.signals as Signal[]))
      .catch(() => {});
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const baseGraph = useMemo(() => buildGraph(ingested), [ingested]);
  const activeGraph = useMemo(
    () => (incidentActive ? reportIncident(DRAINER, baseGraph, { at: 1 }) : baseGraph),
    [baseGraph, incidentActive]
  );
  const scores = useMemo(() => computeAllTrust(activeGraph), [activeGraph]);
  const preScores = useMemo(() => computeAllTrust(baseGraph), [baseGraph]);

  const scoreOf = useCallback((addr: string): TrustScore => scores.get(lc(addr as `0x${string}`))!, [scores]);

  const warnedCount = useMemo(() => {
    if (!incidentActive) return 0;
    let n = 0;
    for (const node of NODES) {
      const k = node.id.toLowerCase();
      const pre = preScores.get(k)?.score ?? 0.5;
      const post = scores.get(k)?.score ?? 0.5;
      if (post < WARN_THRESHOLD && pre >= WARN_THRESHOLD) n++;
    }
    return n;
  }, [incidentActive, preScores, scores]);

  const simulateIncident = () => {
    if (incidentActive) return;
    timers.current.forEach(clearTimeout);
    setBusy(true);

    // REAL recompute: pre (current) vs post (after reportIncident).
    const post = computeAllTrust(reportIncident(DRAINER, baseGraph, { at: 1 }));
    const entries: FeedEntry[] = [];
    entries.push({
      id: DRAINER.toLowerCase(),
      label: "Fresh Contract",
      pre: preScores.get(DRAINER.toLowerCase())!.score,
      post: post.get(DRAINER.toLowerCase())!.score,
      kind: "incident",
    });
    for (const node of NODES) {
      const k = node.id.toLowerCase();
      if (k === DRAINER.toLowerCase()) continue;
      const pre = preScores.get(k)!.score;
      const p = post.get(k)!.score;
      if (pre - p > 0.005) entries.push({ id: k, label: node.label ?? short(node.id), pre, post: p, kind: "downgrade" });
    }
    entries.sort((a, b) => (a.kind === "incident" ? -1 : b.kind === "incident" ? 1 : b.pre - b.post - (a.pre - a.post)));

    setFeed(entries);
    setRevealed(0);
    setSelected(DRAINER.toLowerCase());
    setIncidentActive(true);
    setRippleKey((k) => k + 1);

    // Reveal the feed progressively — the numbers are already real; this just paces them.
    entries.forEach((_, i) => {
      timers.current.push(setTimeout(() => setRevealed(i + 1), 250 + i * 320));
    });
    timers.current.push(setTimeout(() => setBusy(false), 250 + entries.length * 320));
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setIncidentActive(false);
    setFeed([]);
    setRevealed(0);
    setBusy(false);
  };

  const ingestVerdict = async () => {
    // Bridge demo: a Phase 1–4 ALLOW verdict that turned out SAFE → a positive
    // Signal about the swap router, observed by Agent Alpha. Persists to the store.
    const payload = {
      verdict: {
        decision: "ALLOW",
        score: 88,
        intent: { kind: "approve", chain: "base", token: USDC, spender: SWAP_ROUTER_02, amount: "1000", owner: WALLET_1 },
        reasons: [],
        notChecked: [],
        experimental: false,
        source: "local",
        at: new Date().toISOString(),
        verdictId: "vrd_demo",
        failSafe: false,
      },
      observer: AGENT_ALPHA,
      outcome: "safe",
    };
    try {
      const res = await fetch("/api/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? "ingest failed");
      const r = await fetch("/api/signals").then((x) => x.json());
      if (r.ok) setIngested(r.data.signals as Signal[]);
    } catch (err) {
      alert(`Ingest failed: ${err instanceof Error ? err.message : "error"}`);
    }
  };

  const realCount = NODES.filter((n) => n.real).length;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-7 sm:px-8">
      <Header />

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* graph */}
        <div className="cs-glass relative overflow-hidden p-2">
          <Graph
            scores={scores}
            incidentActive={incidentActive}
            rippleKey={rippleKey}
            selected={selected}
            onSelect={setSelected}
          />
          <Legend realCount={realCount} seedCount={NODES.length - realCount} ingested={ingested.length} />
        </div>

        {/* control + panel + feed */}
        <div className="flex flex-col gap-4">
          <Controls
            incidentActive={incidentActive}
            busy={busy}
            warnedCount={warnedCount}
            onSimulate={simulateIncident}
            onReset={reset}
            onIngest={ingestVerdict}
            ingestedCount={ingested.length}
          />
          {selected && <Panel addr={selected} scoreOf={scoreOf} graph={activeGraph} incidentActive={incidentActive} />}
          {feed.length > 0 && <Feed feed={feed} revealed={revealed} />}
        </div>
      </div>

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ header */

function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link
        href="/"
        className="flex items-center gap-3 transition-opacity hover:opacity-80"
        aria-label="Back to ChainSage home"
      >
        <SageMark size={38} />
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-[19px] font-extrabold tracking-tightish">Trust Network</span>
            <StatusBadge status="PREVIEW" />
          </div>
          <div className="micro text-text-3">CHAINSAGE · PHASE 5 · FOUNDATION</div>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 text-text-2 sm:flex">
          <Lock size={14} />
          <span className="micro">REAL ENGINE · SCORES RECOMPUTED LIVE</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------- graph */

function Graph({
  scores,
  incidentActive,
  rippleKey,
  selected,
  onSelect,
}: {
  scores: Map<string, TrustScore>;
  incidentActive: boolean;
  rippleKey: number;
  selected: string | null;
  onSelect: (a: string) => void;
}) {
  // Unique undirected edges between positioned nodes.
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const out: { a: string; b: string }[] = [];
    for (const s of SIGNALS) {
      const a = s.from.toLowerCase();
      const b = s.about.toLowerCase();
      if (a === b || !POSITIONS[a] || !POSITIONS[b]) continue;
      const key = [a, b].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ a, b });
    }
    return out;
  }, []);

  const drainerPos = POSITIONS[DRAINER.toLowerCase()];

  return (
    <svg viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`} className="h-auto w-full" role="img" aria-label="Trust network graph">
      {/* edges */}
      {edges.map(({ a, b }) => {
        const pa = POSITIONS[a];
        const pb = POSITIONS[b];
        const touchesDrainer = incidentActive && (a === DRAINER.toLowerCase() || b === DRAINER.toLowerCase());
        const lowEnd = incidentActive && (scores.get(a)!.score < WARN_THRESHOLD || scores.get(b)!.score < WARN_THRESHOLD);
        const stroke = touchesDrainer || lowEnd ? chainsageColors.danger : "var(--hairline)";
        return (
          <line
            key={`${a}-${b}`}
            className="edge"
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={stroke}
            strokeOpacity={touchesDrainer ? 0.6 : lowEnd ? 0.4 : 1}
            strokeWidth={1.25}
          />
        );
      })}

      {/* incident ripple (decorative; values are real) */}
      {incidentActive && drainerPos && (
        <circle
          key={rippleKey}
          className="cs-ripple"
          cx={drainerPos.x}
          cy={drainerPos.y}
          fill="none"
          stroke={chainsageColors.danger}
          strokeWidth={2}
        />
      )}

      {/* nodes */}
      {NODES.map((node) => {
        const k = node.id.toLowerCase();
        const sc = scores.get(k)!;
        const { color } = bandOf(sc.score);
        const r = radiusByKind[node.kind] + sc.score * 6;
        const isSel = selected === k;
        const p = POSITIONS[k];
        return (
          <g
            key={k}
            className="node"
            transform={`translate(${p.x} ${p.y})`}
            onClick={() => onSelect(k)}
            style={{ cursor: "pointer" }}
          >
            {isSel && <circle r={r + 7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5} />}
            <circle
              r={r}
              fill={`${color}26`}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={node.real ? undefined : "4 3"}
            />
            <text textAnchor="middle" dy={4} className="mono" fontSize={11} fill="var(--text)" style={{ pointerEvents: "none" }}>
              {Math.round(sc.score * 100)}
            </text>
            <text
              textAnchor="middle"
              y={r + 15}
              fontSize={11}
              fill="var(--text-2)"
              style={{ pointerEvents: "none" }}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Legend({ realCount, seedCount, ingested }: { realCount: number; seedCount: number; ingested: number }) {
  return (
    <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-cs border border-card-border bg-bg-2/70 px-3 py-1.5 text-text-3 backdrop-blur">
      <span className="mono text-[11px]">
        <span style={{ color: "var(--text-2)" }}>───</span> real Base ({realCount})
      </span>
      <span className="mono text-[11px]">
        <span style={{ color: "var(--text-2)" }}>- - -</span> seeded ({seedCount})
      </span>
      <span className="mono text-[11px]">ingested signals: {ingested}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- controls */

function Controls({
  incidentActive,
  busy,
  warnedCount,
  onSimulate,
  onReset,
  onIngest,
  ingestedCount,
}: {
  incidentActive: boolean;
  busy: boolean;
  warnedCount: number;
  onSimulate: () => void;
  onReset: () => void;
  onIngest: () => void;
  ingestedCount: number;
}) {
  return (
    <div className="cs-glass flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Spark size={18} className="text-primary" />
        <h2 className="font-bold">Network controls</h2>
      </div>

      {!incidentActive ? (
        <button
          onClick={onSimulate}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-cs px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: chainsageColors.danger }}
        >
          <Alert size={16} /> Simulate Drainer Incident
        </button>
      ) : (
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-cs border border-card-border px-4 py-2.5 text-sm font-semibold transition hover:border-primary"
        >
          <Refresh size={16} /> Reset network
        </button>
      )}

      {incidentActive && (
        <div
          className="rounded-cs border px-3 py-2.5"
          style={{ borderColor: `${chainsageColors.danger}55`, background: `${chainsageColors.danger}12` }}
        >
          <div className="mono text-2xl font-bold" style={{ color: chainsageColors.danger }}>
            {warnedCount}
          </div>
          <div className="micro mt-0.5 text-text-3">entities the network now flags to agents</div>
        </div>
      )}

      <div className="border-t border-hairline pt-3">
        <button
          onClick={onIngest}
          className="flex w-full items-center justify-center gap-2 rounded-cs border border-card-border px-3 py-2 text-sm transition hover:border-primary"
        >
          <Arrow size={15} /> Ingest a verdict outcome
        </button>
        <p className="mt-2 text-xs text-text-3">
          Posts an ALLOW-verdict-turned-safe to the signal store via <span className="mono">/api/signals</span>, then
          recomputes. {ingestedCount} signal{ingestedCount === 1 ? "" : "s"} ingested. Real volume needs real usage.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ entity panel */

function Panel({
  addr,
  scoreOf,
  graph,
  incidentActive,
}: {
  addr: string;
  scoreOf: (a: string) => TrustScore;
  graph: { signals: Signal[] };
  incidentActive: boolean;
}) {
  const node = NODES.find((n) => n.id.toLowerCase() === addr);
  if (!node) return null;
  const sc = scoreOf(addr);
  const band = bandOf(sc.score);
  const about = graph.signals.filter((s) => s.about.toLowerCase() === addr);
  const isDrainer = addr === DRAINER.toLowerCase();

  return (
    <div className="cs-glass flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="micro rounded border border-card-border px-1.5 py-0.5 text-text-3">{node.kind}</span>
        <h3 className="font-semibold">{node.label}</h3>
        <span
          className={`micro ml-auto rounded-full border px-2 py-0.5 ${node.real ? "border-primary/50 text-primary" : "border-card-border text-text-3"}`}
        >
          {node.real ? "REAL · BASE" : "SEED"}
        </span>
      </div>

      <a
        href={`https://basescan.org/address/${node.id}`}
        target="_blank"
        rel="noreferrer"
        className="mono inline-flex items-center gap-1 text-xs text-text-3 hover:text-primary"
      >
        {short(node.id)} <External size={12} />
      </a>

      <div className="flex items-end gap-3">
        <div className="mono text-4xl font-extrabold tracking-tightish" style={{ color: band.color }}>
          {Math.round(sc.score * 100)}
        </div>
        <div className="pb-1">
          <div className="text-sm font-semibold" style={{ color: band.color }}>
            {band.label}
          </div>
          <div className="micro text-text-3">TRUST SCORE / 100</div>
        </div>
      </div>

      {/* confidence */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-text-3">
          <span className="micro">CONFIDENCE</span>
          <span className="mono">
            {Math.round(sc.confidence * 100)}% · {sc.contributors} contributor{sc.contributors === 1 ? "" : "s"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(sc.confidence * 100)}%` }} />
        </div>
      </div>

      {isDrainer && incidentActive && (
        <div className="flex items-center gap-2 text-xs" style={{ color: chainsageColors.danger }}>
          <Ban size={14} /> Incident reported — reputation collapsed and propagating.
        </div>
      )}

      <div className="border-t border-hairline pt-3">
        <div className="micro mb-2 text-text-3">SIGNALS ABOUT THIS ENTITY ({about.length})</div>
        {about.length === 0 ? (
          <p className="text-xs text-text-3">No signals yet — score rests on the neutral prior (low confidence).</p>
        ) : (
          <ul className="flex max-h-44 flex-col gap-1.5 overflow-auto">
            {about.map((s, i) => {
              const c = s.value < 0 ? chainsageColors.danger : s.value > 0.3 ? chainsageColors.trust : chainsageColors.warning;
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="mono rounded px-1.5 py-0.5" style={{ background: `${c}1c`, color: c }}>
                    {s.type === "incident" ? "INCIDENT" : s.value >= 0 ? "+" : ""}
                    {s.value.toFixed(2)}
                  </span>
                  <span className="mono text-text-3">from {short(s.from)}</span>
                  <span className="ml-auto mono text-text-3">w{s.weight}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- live feed */

function Feed({ feed, revealed }: { feed: FeedEntry[]; revealed: number }) {
  return (
    <div className="cs-glass flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <Alert size={16} style={{ color: chainsageColors.danger }} />
        <h3 className="font-semibold">Live signal feed</h3>
      </div>
      <ul className="flex flex-col gap-1.5">
        {feed.slice(0, revealed).map((e) => {
          const drop = e.pre - e.post;
          const color = e.kind === "incident" ? chainsageColors.danger : bandOf(e.post).color;
          return (
            <li key={e.id} className="cs-feed-in flex items-center gap-2 text-xs">
              <span style={{ color }}>{e.kind === "incident" ? <Ban size={14} /> : <Alert size={13} />}</span>
              <span className="font-medium">{e.label}</span>
              <span className="mono ml-auto text-text-3">
                {Math.round(e.pre * 100)} → <span style={{ color }}>{Math.round(e.post * 100)}</span>
                <span className="text-text-3"> (−{Math.round(drop * 100)})</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-1 border-t border-hairline pt-6 text-center text-xs text-text-3">
      <div className="flex items-center gap-2">
        <SageMark size={18} />
        <span>ChainSage Trust Network — the foundation: a real, tested reputation engine.</span>
      </div>
      <span className="mono">
        Becoming the default standard requires adoption, multi-party participation & time — see README
      </span>
    </footer>
  );
}
