"use client";

/**
 * Verdict visuals — the same aesthetic as Guardian's VerdictRing, here reused
 * by the console's "try it" widget. Color comes from the shared engine's
 * verdictColor (the sacred ALLOW=trust / REVIEW=warning / DENY=danger mapping).
 */
import { useEffect, useRef, useState } from "react";
import { verdictColor, type Verdict } from "@chainsage/engine";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function VerdictRing({
  score,
  verdict,
  size = 200,
}: {
  score: number;
  verdict: Verdict;
  size?: number;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(score);
      return;
    }
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * score));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

  const color = verdictColor[verdict];
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (display / 100) * circumference;

  return (
    <div style={{ width: size, height: size }} className="relative grid place-items-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: `0 0 60px 0 ${color}55, inset 0 0 40px 0 ${color}22`, opacity: 0.9 }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="mono font-semibold leading-none" style={{ fontSize: size * 0.27, color }}>
          {display}
        </span>
        <span className="micro mt-2" style={{ color }}>
          {verdict}
        </span>
        <span className="micro mt-1 text-text-3">health score</span>
      </div>
    </div>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const color = verdictColor[verdict];
  return (
    <span
      className="mono inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
      style={{ color, background: `${color}1A`, border: `1px solid ${color}55` }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {verdict}
    </span>
  );
}
