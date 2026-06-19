"use client";

/**
 * VerdictRing — an SVG dial whose arc fills to the health score and whose color
 * is the sacred verdict color. The number counts up on mount (and respects
 * prefers-reduced-motion). A soft glow tints the whole ring by verdict.
 */
import { useEffect, useRef, useState } from "react";
import { verdictColor, type Verdict } from "@/lib/tokens";

interface Props {
  score: number;
  verdict: Verdict;
  size?: number;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function VerdictRing({ score, verdict, size = 240 }: Props) {
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
      // easeOutCubic
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
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (display / 100) * circumference;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative grid place-items-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 60px 0 ${color}55, inset 0 0 40px 0 ${color}22`,
          opacity: 0.9,
        }}
      />
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
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
        <span
          className="mono font-semibold leading-none"
          style={{ fontSize: size * 0.27, color }}
        >
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
