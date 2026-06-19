"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { type Verdict, verdictColor, verdictRgba } from "@/lib/verdict";

type Scenario = {
  intent: string;
  detail: string;
  verdict: Verdict;
  reason: string;
};

const SCENARIOS: Scenario[] = [
  {
    intent: "Swap 2.5 ETH → USDC",
    detail: "Uniswap v3 · 0.3% pool",
    verdict: "ALLOW",
    reason: "Known router · slippage 0.4% · no policy breach",
  },
  {
    intent: "approve(unlimited) → 0x9f…b2",
    detail: "Unverified spender contract",
    verdict: "DENY",
    reason: "Drainer signature match · unlimited allowance · blocked",
  },
  {
    intent: "Bridge 12,000 USDC → Base",
    detail: "First transfer to new address",
    verdict: "REVIEW",
    reason: "Amount above policy threshold · human confirm",
  },
];

const STAGES = ["Simulate", "Analyze", "Policy", "Trust Network"] as const;

export function VerdictEngine() {
  const reduce = useReducedMotion();
  const [si, setSi] = useState(0);
  // phase: 0 idle/intent → 1..4 pipeline stages → 5 verdict
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduce) {
      setPhase(5);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    // sequence durations
    const steps = [600, 700, 700, 700, 800, 1900];
    let acc = 0;
    steps.forEach((d, i) => {
      acc += d;
      timers.push(
        setTimeout(() => {
          if (i < 5) setPhase(i + 1);
          else {
            // advance scenario, reset
            setSi((s) => (s + 1) % SCENARIOS.length);
            setPhase(0);
          }
        }, acc),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [si, reduce]);

  const sc = SCENARIOS[si];
  const v = sc.verdict;
  const color = verdictColor[v];
  const activeStage = phase >= 1 && phase <= 4 ? phase - 1 : -1;
  const showVerdict = phase === 5;

  return (
    <div className="cs-glass relative w-full overflow-hidden p-5 sm:p-6">
      {/* header */}
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-text-3">
          verdict engine
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[0.7rem] text-text-3">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--cyan)]" />
          live trace
        </span>
      </div>

      {/* Agent intent */}
      <div className="mb-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-2)]/60 p-3.5">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--primary)]/20 text-[0.65rem]">
            🤖
          </span>
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-text-3">
            agent intent
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`intent-${si}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
          >
            <code className="block font-mono text-[0.92rem] text-text">
              {sc.intent}
            </code>
            <span className="font-mono text-[0.72rem] text-text-3">
              {sc.detail}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* pipeline */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {STAGES.map((stage, i) => {
          const done = activeStage > i || showVerdict;
          const active = activeStage === i;
          return (
            <div
              key={stage}
              className="relative flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-colors"
              style={{
                borderColor: active
                  ? "var(--primary)"
                  : done
                    ? "var(--card-border)"
                    : "var(--hairline)",
                background: active ? "rgba(124,92,255,0.12)" : "transparent",
              }}
            >
              <motion.span
                className="h-2 w-2 rounded-full"
                animate={{
                  scale: active ? [1, 1.6, 1] : 1,
                  backgroundColor: done || active ? "#7C5CFF" : "var(--text-3)",
                }}
                transition={{
                  duration: 0.8,
                  repeat: active ? Infinity : 0,
                }}
              />
              <span
                className="text-center font-mono text-[0.6rem] uppercase leading-tight tracking-[0.04em]"
                style={{ color: active || done ? "var(--text)" : "var(--text-3)" }}
              >
                {stage}
              </span>
              {i < STAGES.length - 1 && (
                <span className="absolute -right-[5px] top-1/2 h-px w-2 -translate-y-1/2 bg-[var(--hairline)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* verdict + execution */}
      <div className="relative mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-2)]/60 p-4">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.1em] text-text-3">
            verdict
          </span>
          <div className="mt-1 h-7">
            <AnimatePresence mode="wait">
              {showVerdict ? (
                <motion.div
                  key={`v-${si}`}
                  initial={
                    reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
                  }
                  animate={
                    reduce
                      ? { opacity: 1, scale: 1 }
                      : { opacity: [0, 1, 1], scale: [0.8, 1.08, 1] }
                  }
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          // Overshoot stamp — the brief pop past 1.0 is the "iOS feel".
                          duration: 0.46,
                          times: [0, 0.6, 1],
                          ease: [0.34, 1.56, 0.64, 1],
                        }
                  }
                  className="flex items-center gap-2"
                >
                  <span
                    className="rounded-md px-2.5 py-1 font-mono text-sm font-bold tracking-[0.08em]"
                    style={{
                      color,
                      background: verdictRgba(v, 0.16),
                      border: `1px solid ${verdictRgba(v, 0.5)}`,
                      boxShadow: `0 0 24px ${verdictRgba(v, 0.4)}`,
                    }}
                  >
                    {v}
                  </span>
                </motion.div>
              ) : (
                <motion.span
                  key="pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-sm text-text-3"
                >
                  evaluating…
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* execution gate */}
        <div className="flex flex-col items-center">
          <span className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-3">
            execution
          </span>
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-lg border text-sm"
            animate={{
              borderColor: !showVerdict
                ? "var(--hairline)"
                : v === "DENY"
                  ? verdictColor.DENY
                  : v === "REVIEW"
                    ? verdictColor.REVIEW
                    : verdictColor.ALLOW,
              opacity: showVerdict && v === "DENY" ? 0.5 : 1,
            }}
          >
            {showVerdict ? (
              v === "DENY" ? (
                <span style={{ color: verdictColor.DENY }}>⛔</span>
              ) : v === "REVIEW" ? (
                <span style={{ color: verdictColor.REVIEW }}>⏸</span>
              ) : (
                <span style={{ color: verdictColor.ALLOW }}>→</span>
              )
            ) : (
              <span className="text-text-3">·</span>
            )}
          </motion.div>
        </div>
      </div>

      {/* reason line */}
      <AnimatePresence mode="wait">
        {showVerdict && (
          <motion.p
            key={`r-${si}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 font-mono text-[0.72rem] leading-relaxed"
            style={{ color: verdictRgba(v, 0.95) }}
          >
            {v === "DENY" ? "✕ " : v === "REVIEW" ? "? " : "✓ "}
            {sc.reason}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
