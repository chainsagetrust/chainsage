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

/** True when the user has asked the OS for reduced motion. SSR-safe (false until mounted). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

const DRAINER_LC = DRAINER.toLowerCase();
const TAU = Math.PI * 2;
const RADIUS_OF = (node: SeedNode, score: number) => radiusByKind[node.kind] + score * 6;

/** Live, mutable per-node sim state. Seeded from the hand-authored seed positions. */
interface PNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number; // home (anchor) — the seed position the node breathes around
  hy: number;
  ph: number; // breathing phase offset so nodes don't pulse in lockstep
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  o: number;
  c: string;
}

// Brand-only palette for ambient atmosphere (NEVER verdict colors).
const PARTICLE_COLORS = [chainsageColors.primary, chainsageColors.accent, chainsageColors.secondary];

/** Hop distance from the drainer over the undirected edge set (for ripple timing). */
function hopDistances(edges: { a: string; b: string }[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const { a, b } of edges) {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  const dist = new Map<string, number>();
  const queue = [DRAINER_LC];
  dist.set(DRAINER_LC, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) {
        dist.set(nb, dist.get(cur)! + 1);
        queue.push(nb);
      }
    }
  }
  return dist;
}

// Force-sim tuning. Mild on purpose: nodes are anchored to their seed positions
// and breathe, so the layout stays recognizable and never drifts away.
const ANCHOR_K = 0.022;
const REPULSE = 1500;
const LINK_K = 0.0016;
const FRICTION = 0.9;
const BREATH_AMP = 4.5;
const BREATH_SPEED = 0.00042;
const HOP_MS = 230; // how long the red wave takes to cross one edge
const BASE_DELAY = 90;

/**
 * The interactive graph. The geometry moves (force sim + breathing) and the
 * displayed score number/ring TWEEN toward the real engine score — but every
 * value converges to `scores`, which the parent computes from the real engine.
 * Animation never invents a number; it only paces what is already true.
 */
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
  const reduced = usePrefersReducedMotion();

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

  const hops = useMemo(() => hopDistances(edges), [edges]);
  const restLen = useMemo(() => {
    const m = new Map<string, number>();
    for (const { a, b } of edges) {
      const pa = POSITIONS[a];
      const pb = POSITIONS[b];
      m.set(`${a}-${b}`, Math.hypot(pa.x - pb.x, pa.y - pb.y));
    }
    return m;
  }, [edges]);

  const [hover, setHover] = useState<string | null>(null);
  const [, setTick] = useState(0); // forces a re-render each animation frame

  // Latest props mirrored into refs so the long-lived RAF closure reads fresh values.
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const incidentRef = useRef(incidentActive);
  incidentRef.current = incidentActive;

  // Sim state lives in refs (mutated per frame; React re-render is just a paint trigger).
  const nodesRef = useRef<Map<string, PNode> | null>(null);
  const dispRef = useRef<Map<string, number> | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const phaseStartRef = useRef(0); // when the current incident/reset phase began (ms)

  if (!nodesRef.current) {
    const nm = new Map<string, PNode>();
    const dm = new Map<string, number>();
    NODES.forEach((n, i) => {
      const p = POSITIONS[n.id.toLowerCase()];
      nm.set(n.id.toLowerCase(), { x: p.x, y: p.y, vx: 0, vy: 0, hx: p.x, hy: p.y, ph: (i * TAU) / NODES.length });
      dm.set(n.id.toLowerCase(), 0); // start empty → rings fill / numbers count up on first load
    });
    nodesRef.current = nm;
    dispRef.current = dm;
  }

  // Mark a new phase (incident fired / reset) and kick the nodes outward from the
  // drainer so the collapse physically shoves its neighbours — a real shockwave.
  useEffect(() => {
    phaseStartRef.current = typeof performance !== "undefined" ? performance.now() : 0;
    if (incidentActive && !reduced) {
      const nodes = nodesRef.current!;
      const d = nodes.get(DRAINER_LC);
      if (d) {
        for (const [id, n] of nodes) {
          if (id === DRAINER_LC) continue;
          const dx = n.x - d.x;
          const dy = n.y - d.y;
          const dist = Math.hypot(dx, dy) || 1;
          const kick = 240 / dist; // closer neighbours get shoved harder
          n.vx += (dx / dist) * kick;
          n.vy += (dy / dist) * kick;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentActive]);

  // Reduced-motion: no sim, no drift. Snap geometry home and the score to the real
  // value immediately, then a single repaint. The honest data still updates.
  useEffect(() => {
    if (!reduced) return;
    const nodes = nodesRef.current!;
    const disp = dispRef.current!;
    for (const [id, n] of nodes) {
      n.x = n.hx;
      n.y = n.hy;
      n.vx = 0;
      n.vy = 0;
      disp.set(id, scores.get(id)?.score ?? 0.5);
    }
    setTick((t) => t + 1);
  }, [reduced, scores, incidentActive]);

  // The single RAF loop: force integration + score tween + particle drift.
  // Pauses when the tab is hidden and when reduced-motion is on.
  useEffect(() => {
    if (reduced) return;

    // Seed the ambient particle field once (deterministic-enough; client only).
    if (particlesRef.current.length === 0) {
      const N = 16;
      for (let i = 0; i < N; i++) {
        particlesRef.current.push({
          x: Math.random() * VIEWBOX.w,
          y: Math.random() * VIEWBOX.h,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          r: 0.8 + Math.random() * 1.8,
          o: 0.04 + Math.random() * 0.1,
          c: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        });
      }
    }

    let raf = 0;
    let last = typeof performance !== "undefined" ? performance.now() : 0;
    let running = true;

    const nodeArr = [...nodesRef.current!.values()];
    const nodeIds = [...nodesRef.current!.keys()];

    const step = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); // clamp big gaps (tab refocus)
      last = now;
      const f = Math.min(2, dt * 60); // frame-normalized factor
      const nodes = nodesRef.current!;
      const disp = dispRef.current!;
      const T = now;

      // --- forces ---
      for (let i = 0; i < nodeArr.length; i++) {
        const n = nodeArr[i];
        const tx = n.hx + Math.sin(T * BREATH_SPEED + n.ph) * BREATH_AMP;
        const ty = n.hy + Math.cos(T * BREATH_SPEED * 0.9 + n.ph) * BREATH_AMP;
        n.vx += (tx - n.x) * ANCHOR_K * f;
        n.vy += (ty - n.y) * ANCHOR_K * f;
      }
      // pairwise repulsion (11 nodes → trivial)
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i];
          const b = nodeArr[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const force = Math.min(0.5, REPULSE / d2);
          const d = Math.sqrt(d2);
          const fx = (dx / d) * force * f;
          const fy = (dy / d) * force * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // link springs (keep edge lengths near their seed rest length → edges flex)
      for (const { a, b } of edges) {
        const na = nodes.get(a)!;
        const nb = nodes.get(b)!;
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const d = Math.hypot(dx, dy) || 1;
        const rest = restLen.get(`${a}-${b}`) ?? d;
        const pull = (d - rest) * LINK_K * f;
        const ux = dx / d;
        const uy = dy / d;
        na.vx += ux * pull;
        na.vy += uy * pull;
        nb.vx -= ux * pull;
        nb.vy -= uy * pull;
      }
      // integrate + friction
      const fric = Math.pow(FRICTION, f);
      for (const n of nodeArr) {
        n.vx *= fric;
        n.vy *= fric;
        n.x += n.vx * f;
        n.y += n.vy * f;
      }

      // --- score tween: ease displayed → real, gated by the ripple wavefront ---
      const phaseAge = now - phaseStartRef.current;
      const incident = incidentRef.current;
      const sc = scoresRef.current;
      const ease = 1 - Math.exp(-dt * 6); // ~fast count, still smooth
      for (const id of nodeIds) {
        const target = sc.get(id)?.score ?? 0.5;
        const hop = hops.get(id) ?? 6;
        const delay = BASE_DELAY + hop * HOP_MS;
        // Hold the value until the wavefront reaches this node, so the drain
        // (and the recovery on reset) visibly travels outward node-by-node.
        if (phaseAge < delay) continue;
        const cur = disp.get(id)!;
        disp.set(id, cur + (target - cur) * ease);
      }

      // --- particles drift, wrapping around the canvas ---
      for (const p of particlesRef.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -10) p.x = VIEWBOX.w + 10;
        if (p.x > VIEWBOX.w + 10) p.x = -10;
        if (p.y < -10) p.y = VIEWBOX.h + 10;
        if (p.y > VIEWBOX.h + 10) p.y = -10;
      }

      setTick((t) => (t + 1) % 1e9);
      raf = requestAnimationFrame(step);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(step);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, edges, hops, restLen]);

  // --- render (reads the freshly-mutated refs) ---
  const nodes = nodesRef.current!;
  const disp = dispRef.current!;
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const phaseAge = now - phaseStartRef.current;

  const neighbors = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    for (const { a, b } of edges) {
      if (a === hover) set.add(b);
      if (b === hover) set.add(a);
    }
    return set;
  }, [hover, edges]);

  const drainer = nodes.get(DRAINER_LC)!;
  const shake = incidentActive && !reduced && phaseAge < 900;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      className="h-auto w-full select-none"
      role="img"
      aria-label="Trust network graph"
    >
      <defs>
        {/* Ambient brand-flow gradient for the travelling edge pulse (decorative). */}
        <linearGradient id="csFlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={chainsageColors.primary} stopOpacity="0" />
          <stop offset="50%" stopColor={chainsageColors.secondary} stopOpacity="0.9" />
          <stop offset="100%" stopColor={chainsageColors.accent} stopOpacity="0" />
        </linearGradient>
        {/* Luminous sheen overlaid on every node so it reads as a 3-D object. */}
        <radialGradient id="csSheen" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Background atmosphere — faint brand-tinted depth, not verdict color. */}
        <radialGradient id="csAtmosphere" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor={chainsageColors.primary} stopOpacity="0.10" />
          <stop offset="55%" stopColor={chainsageColors.accent} stopOpacity="0.04" />
          <stop offset="100%" stopColor={chainsageColors.primary} stopOpacity="0" />
        </radialGradient>
        <filter id="csGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="csNodeShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* background atmosphere */}
      <rect x="0" y="0" width={VIEWBOX.w} height={VIEWBOX.h} fill="url(#csAtmosphere)" />

      {/* drifting particle field (brand-tinted; hidden under reduced motion) */}
      {!reduced &&
        particlesRef.current.map((p, i) => (
          <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
        ))}

      {/* structural edges (carry verdict-red state during an incident) */}
      {edges.map(({ a, b }) => {
        const na = nodes.get(a)!;
        const nb = nodes.get(b)!;
        const touchesDrainer = incidentActive && (a === DRAINER_LC || b === DRAINER_LC);
        const lowEnd =
          incidentActive && ((disp.get(a) ?? 0.5) < WARN_THRESHOLD || (disp.get(b) ?? 0.5) < WARN_THRESHOLD);
        // Wavefront flash: brighten red as the ripple crosses this edge, then settle.
        const minHop = Math.min(hops.get(a) ?? 6, hops.get(b) ?? 6);
        const edgeAge = phaseAge - (BASE_DELAY + minHop * HOP_MS);
        const flash = incidentActive && edgeAge >= 0 && edgeAge < 520 ? 1 - edgeAge / 520 : 0;
        const isRed = touchesDrainer || lowEnd;
        const dim = neighbors && !(neighbors.has(a) && neighbors.has(b));
        const stroke = isRed ? chainsageColors.danger : neighbors && !dim ? chainsageColors.primary : "var(--hairline)";
        const baseOp = isRed ? (touchesDrainer ? 0.6 : 0.4) : neighbors && !dim ? 0.5 : 1;
        return (
          <g key={`${a}-${b}`}>
            <line
              className="edge"
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              stroke={stroke}
              strokeOpacity={dim ? 0.12 : Math.min(1, baseOp + flash * 0.6)}
              strokeWidth={1.25 + flash * 2.5}
            />
            {/* ambient trust-flow pulse — suppressed where the edge has gone red */}
            {!reduced && !isRed && !dim && (
              <line
                x1={na.x}
                y1={na.y}
                x2={nb.x}
                y2={nb.y}
                className="cs-edge-flow"
                stroke="url(#csFlow)"
                strokeWidth={2}
                strokeOpacity={0.5}
                strokeDasharray="14 120"
                style={{ animationDelay: `${(minHop % 4) * -0.5}s` }}
              />
            )}
          </g>
        );
      })}

      {/* cinematic shockwave off the collapsing node (decorative; values are real) */}
      {incidentActive && drainer && (
        <g key={rippleKey}>
          {!reduced ? (
            <>
              <circle
                className="cs-shockwave"
                cx={drainer.x}
                cy={drainer.y}
                fill="none"
                stroke={chainsageColors.danger}
              />
              <circle
                className="cs-shockwave-2"
                cx={drainer.x}
                cy={drainer.y}
                fill="none"
                stroke={chainsageColors.danger}
              />
            </>
          ) : (
            <circle className="cs-ripple" cx={drainer.x} cy={drainer.y} fill="none" stroke={chainsageColors.danger} strokeWidth={2} />
          )}
        </g>
      )}

      {/* nodes */}
      {NODES.map((node) => {
        const k = node.id.toLowerCase();
        const n = nodes.get(k)!;
        const shown = disp.get(k) ?? 0.5; // tweened toward the real engine score
        const { color } = bandOf(shown);
        const hop = hops.get(k) ?? 6;
        // flinch: a brief radius kick as the wavefront hits this node
        const u = phaseAge - (BASE_DELAY + hop * HOP_MS);
        const flinch = incidentActive && !reduced && u >= 0 && u < 320 ? Math.sin((Math.PI * u) / 320) * 5 : 0;
        const r = RADIUS_OF(node, shown) + flinch + (hover === k ? 3 : 0);
        const isSel = selected === k;
        const isHover = hover === k;
        const dimmed = neighbors ? !neighbors.has(k) : false;

        // score ring (animates as `shown` tweens)
        const ringR = r + 6;
        const circ = TAU * ringR;
        const fillFrac = Math.max(0, Math.min(1, shown));

        return (
          <g
            key={k}
            className="node"
            transform={`translate(${n.x} ${n.y})`}
            onClick={() => onSelect(k)}
            onMouseEnter={() => setHover(k)}
            onMouseLeave={() => setHover((h) => (h === k ? null : h))}
            style={{ cursor: "pointer", opacity: dimmed ? 0.32 : 1 }}
          >
            <g className={k === DRAINER_LC && shake ? "cs-node-shake" : undefined}>
              {/* score-colored halo (depth — glow in the node's OWN score color) */}
              <circle r={r + (isHover ? 10 : 6)} fill={color} opacity={isHover ? 0.3 : 0.16} filter="url(#csGlow)" />

              {/* selection ring */}
              {isSel && <circle r={ringR + 5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5} />}

              {/* animated score ring (track + fill arc) */}
              <circle r={ringR} fill="none" stroke="var(--hairline)" strokeWidth={2} />
              <circle
                r={ringR}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={`${circ * fillFrac} ${circ}`}
                transform="rotate(-90)"
                style={{ transition: "stroke-dasharray 0.12s linear" }}
              />

              {/* node body: solid surface + inner sheen for a luminous, 3-D read */}
              <circle
                r={r}
                fill="var(--node-fill)"
                stroke={color}
                strokeWidth={isHover ? 2.5 : 2}
                strokeDasharray={node.real ? undefined : "4 3"}
                filter="url(#csNodeShadow)"
              />
              <circle r={r} fill={`${color}26`} />
              <circle r={r} fill="url(#csSheen)" />

              <text
                textAnchor="middle"
                dy={4}
                className="mono"
                fontSize={11}
                fill="var(--text)"
                style={{ pointerEvents: "none" }}
              >
                {Math.round(shown * 100)}
              </text>
            </g>
            <text textAnchor="middle" y={r + 16} fontSize={11} fill="var(--text-2)" style={{ pointerEvents: "none" }}>
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
