"use client";

/**
 * Trust Network — an interactive SVG reputation graph. Click a node to inspect
 * it; run "Simulate Drainer Incident" to watch a reputation collapse ripple
 * through connected nodes, stream a live signal feed, and spike the
 * wallets-protected counter. DANGER color is used here for genuine risk state
 * (a node going malicious) — semantically correct, not decorative.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Reveal } from "./motion";
import { SectionHeading, Button } from "./ui";
import { verdictColor } from "@/lib/verdict";

type Kind = "agent" | "contract" | "protocol";
type Node = {
  id: string;
  label: string;
  kind: Kind;
  x: number;
  y: number;
  score: number;
};

const NODES: Node[] = [
  { id: "router", label: "Uniswap Router", kind: "protocol", x: 300, y: 90, score: 98 },
  { id: "aave", label: "Aave v3", kind: "protocol", x: 120, y: 170, score: 96 },
  { id: "agentA", label: "Trading Agent", kind: "agent", x: 470, y: 160, score: 91 },
  { id: "agentB", label: "Yield Agent", kind: "agent", x: 230, y: 250, score: 88 },
  { id: "vault", label: "Vault Contract", kind: "contract", x: 410, y: 290, score: 84 },
  { id: "bridge", label: "Bridge Adapter", kind: "contract", x: 560, y: 250, score: 79 },
  { id: "unknown", label: "0x9f…b2", kind: "contract", x: 150, y: 330, score: 41 },
];

const EDGES: [string, string][] = [
  ["router", "agentA"],
  ["router", "aave"],
  ["aave", "agentB"],
  ["agentA", "vault"],
  ["agentA", "bridge"],
  ["agentB", "vault"],
  ["agentB", "unknown"],
  ["vault", "bridge"],
];

const KIND_LABEL: Record<Kind, string> = {
  agent: "Autonomous agent",
  contract: "Smart contract",
  protocol: "Protocol",
};

function standing(score: number) {
  if (score >= 85) return { label: "Trusted", color: verdictColor.ALLOW };
  if (score >= 60) return { label: "Caution", color: verdictColor.REVIEW };
  return { label: "Untrusted", color: verdictColor.DENY };
}

const byId = (id: string) => NODES.find((n) => n.id === id)!;

export function TrustNetwork() {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string>("agentA");
  const [compromised, setCompromised] = useState<Set<string>>(new Set());
  const [feed, setFeed] = useState<string[]>([]);
  const [protectedCount, setProtectedCount] = useState(18420);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const sel = byId(selected);
  const selStanding = standing(
    compromised.has(sel.id) ? 4 : sel.score,
  );

  const simulate = () => {
    if (running) return;
    timers.current.forEach(clearTimeout);
    setRunning(true);
    setCompromised(new Set());
    setFeed([]);

    // origin = the low-trust unknown contract; ripple to its neighbours.
    const origin = "unknown";
    const neighbours = EDGES.filter(([a, b]) => a === origin || b === origin).map(
      ([a, b]) => (a === origin ? b : a),
    );
    const ripple = [origin, ...neighbours];

    const steps: { t: number; fn: () => void }[] = [
      {
        t: 0,
        fn: () => {
          setCompromised(new Set([origin]));
          setFeed((f) => [`⚠ Drainer signature detected at ${byId(origin).label}`, ...f]);
        },
      },
      ...ripple.slice(1).map((id, i) => ({
        t: 600 * (i + 1),
        fn: () => {
          setCompromised((c) => new Set([...c, id]));
          setFeed((f) => [
            `↯ Trust collapse propagating → ${byId(id).label}`,
            ...f,
          ]);
        },
      })),
      {
        t: 600 * ripple.length + 200,
        fn: () => {
          setFeed((f) => [
            `✓ Verdict pushed network-wide: DENY on ${byId(origin).label}`,
            ...f,
          ]);
          setProtectedCount((c) => c + 1247);
        },
      },
      {
        t: 600 * ripple.length + 600,
        fn: () => setRunning(false),
      },
    ];

    if (reduce) {
      steps.forEach((s) => s.fn());
      setRunning(false);
      return;
    }
    steps.forEach((s) => {
      timers.current.push(setTimeout(s.fn, s.t));
    });
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setCompromised(new Set());
    setFeed([]);
    setRunning(false);
  };

  return (
    <section id="network" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="Trust network"
          title="A shared memory for the agent economy"
          intro="Every verdict feeds a reputation graph. When one node turns malicious, the whole network knows in seconds — and every connected wallet is protected at once."
        />
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          {/* graph */}
          <div className="cs-glass relative overflow-hidden p-3">
            <svg viewBox="0 0 680 400" className="h-auto w-full" role="img" aria-label="Trust network graph">
              {EDGES.map(([a, b]) => {
                const na = byId(a);
                const nb = byId(b);
                const hot = compromised.has(a) && compromised.has(b);
                return (
                  <line
                    key={`${a}-${b}`}
                    x1={na.x}
                    y1={na.y}
                    x2={nb.x}
                    y2={nb.y}
                    stroke={hot ? verdictColor.DENY : "var(--hairline)"}
                    strokeWidth={hot ? 2 : 1}
                    opacity={hot ? 0.8 : 0.6}
                  />
                );
              })}
              {NODES.map((n) => {
                const isComp = compromised.has(n.id);
                const isSel = selected === n.id;
                const st = standing(isComp ? 4 : n.score);
                const r = n.kind === "protocol" ? 26 : n.kind === "agent" ? 22 : 18;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelected(n.id)}
                    role="button"
                    aria-label={`${n.label}, trust ${n.score}`}
                  >
                    {isSel && (
                      <circle r={r + 7} fill="none" stroke="var(--primary)" strokeWidth={1.5} opacity={0.7} />
                    )}
                    <motion.circle
                      r={r}
                      animate={{
                        fill: isComp ? "rgba(244,83,79,0.22)" : "var(--bg-2)",
                        stroke: isComp ? verdictColor.DENY : st.color,
                      }}
                      strokeWidth={2}
                    />
                    <text
                      textAnchor="middle"
                      dy="-1"
                      className="font-mono"
                      style={{ fontSize: 10, fill: "var(--text)" }}
                    >
                      {isComp ? "✕" : n.score}
                    </text>
                    <text
                      textAnchor="middle"
                      y={r + 14}
                      className="font-mono"
                      style={{ fontSize: 9, fill: "var(--text-3)" }}
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-2">
              <Button onClick={simulate} className="px-4 py-2 text-[0.85rem]">
                {running ? "Simulating…" : "Simulate Drainer Incident"}
              </Button>
              {compromised.size > 0 && !running && (
                <Button onClick={reset} variant="ghost" className="px-4 py-2 text-[0.85rem]">
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* side panel + feed + counter */}
          <div className="flex flex-col gap-4">
            <div className="cs-glass p-5">
              <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-3">
                {KIND_LABEL[sel.kind]}
              </div>
              <div className="mt-1 font-display text-xl font-bold text-text">
                {sel.label}
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-3">
                    Trust score
                  </div>
                  <div
                    className="font-mono text-3xl font-bold"
                    style={{ color: selStanding.color }}
                  >
                    {compromised.has(sel.id) ? 4 : sel.score}
                  </div>
                </div>
                <span
                  className="rounded-full px-3 py-1 font-mono text-[0.66rem] font-bold uppercase tracking-[0.08em]"
                  style={{
                    color: selStanding.color,
                    background: `${selStanding.color}1f`,
                    border: `1px solid ${selStanding.color}55`,
                  }}
                >
                  {selStanding.label}
                </span>
              </div>
            </div>

            <div className="cs-glass p-5">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-3">
                  Wallets protected
                </div>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cyan)]" />
              </div>
              <motion.div
                key={protectedCount}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.06, 1] }}
                className="mt-1 font-mono text-2xl font-bold text-text"
              >
                {protectedCount.toLocaleString()}
              </motion.div>

              <div className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-3">
                Signal feed
              </div>
              <div className="cs-scroll mt-2 h-28 space-y-1.5 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {feed.length === 0 ? (
                    <p className="font-mono text-[0.7rem] text-text-3">
                      Idle — run the simulation to stream live signals.
                    </p>
                  ) : (
                    feed.map((line, i) => (
                      <motion.p
                        key={`${line}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="font-mono text-[0.7rem] leading-snug"
                        style={{
                          color: line.startsWith("✓")
                            ? verdictColor.ALLOW
                            : line.startsWith("⚠") || line.startsWith("↯")
                              ? verdictColor.DENY
                              : "var(--text-2)",
                        }}
                      >
                        {line}
                      </motion.p>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
