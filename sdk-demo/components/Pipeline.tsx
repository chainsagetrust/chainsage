"use client";

/**
 * The conceptual verdict pipeline. HONEST LABELING: only the stages that do real
 * work today are live — "Risk engine" runs the on-chain reads. "Policy" and
 * "Trust network" are roadmap (Phase 4/5) and do NOT yet contribute to the
 * verdict; they're marked accordingly.
 */
import { verdictColor } from "@/lib/tokens";
import type { Decision } from "./Verdict";

export interface Stage {
  label: string;
  real?: boolean;
  roadmap?: boolean;
}

export const STAGES: Stage[] = [
  { label: "Decode intent" },
  { label: "Simulate" },
  { label: "Risk engine", real: true },
  { label: "Policy", roadmap: true },
  { label: "Trust network", roadmap: true },
  { label: "Verdict" },
];

export function Pipeline({
  activeIndex,
  decision,
}: {
  activeIndex: number; // -1 idle; STAGES.length-1 = verdict reached
  decision?: Decision;
}) {
  const verdictReached = activeIndex >= STAGES.length - 1 && !!decision;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STAGES.map((s, i) => {
        const isLast = i === STAGES.length - 1;
        const active = i === activeIndex;
        const done = i < activeIndex;
        const isVerdictNode = isLast;

        let color = "var(--text-3)";
        let bg = "transparent";
        let border = "var(--hairline)";
        if (isVerdictNode && verdictReached && decision) {
          color = verdictColor[decision];
          bg = `${verdictColor[decision]}1A`;
          border = `${verdictColor[decision]}66`;
        } else if (active) {
          color = "var(--primary)";
          bg = "rgba(124,92,255,0.12)";
          border = "rgba(124,92,255,0.5)";
        } else if (done) {
          color = "var(--text-2)";
          border = "var(--card-border)";
        }

        return (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className={`mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors ${active ? "cs-pulse" : ""}`}
              style={{ color, background: bg, border: `1px solid ${border}` }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: done || active || (isVerdictNode && verdictReached) ? color : "var(--text-3)" }}
              />
              {s.label}
              {s.real && <span className="opacity-60">· live</span>}
              {s.roadmap && <span className="opacity-50">· roadmap</span>}
            </span>
            {i < STAGES.length - 1 && (
              <span className="text-text-3" style={{ opacity: done ? 1 : 0.3 }}>
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
