"use client";

import { verdictColor } from "@/lib/tokens";
import { CheckC, Ban, Hand } from "./Brand";

export type Decision = "ALLOW" | "REVIEW" | "DENY";

const ICON: Record<Decision, typeof CheckC> = {
  ALLOW: CheckC,
  REVIEW: Hand,
  DENY: Ban,
};

export function VerdictPill({ decision, size = "md" }: { decision: Decision; size?: "md" | "lg" }) {
  const color = verdictColor[decision];
  const Ic = ICON[decision];
  const lg = size === "lg";
  return (
    <span
      className={`mono inline-flex items-center gap-2 rounded-full font-semibold ${lg ? "px-4 py-2 text-base" : "px-3 py-1 text-sm"}`}
      style={{ color, background: `${color}1A`, border: `1px solid ${color}55` }}
    >
      <Ic size={lg ? 18 : 15} />
      {decision}
    </span>
  );
}

/** Compact score dial that fills to the verdict color. */
export function ScoreDial({ score, decision, size = 96 }: { score: number; decision: Decision; size?: number }) {
  const color = verdictColor[decision];
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  return (
    <div style={{ width: size, height: size }} className="relative grid place-items-center">
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
          strokeDasharray={circ}
          strokeDashoffset={circ - progress}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dashoffset .8s var(--ease)" }}
        />
      </svg>
      <span className="mono absolute font-semibold" style={{ color, fontSize: size * 0.3 }}>
        {score}
      </span>
    </div>
  );
}
