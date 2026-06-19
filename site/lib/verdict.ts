import { chainsageColors, type Verdict, verdictColor } from "./tokens";

export type { Verdict };
export { verdictColor };

export const verdictLabel: Record<Verdict, string> = {
  ALLOW: "ALLOW",
  REVIEW: "REVIEW",
  DENY: "DENY",
};

export const verdictGlyph: Record<Verdict, string> = {
  ALLOW: "✓",
  REVIEW: "?",
  DENY: "✕",
};

/** rgba helper for a sacred verdict color at given alpha. */
export function verdictRgba(v: Verdict, alpha: number): string {
  const hex = verdictColor[v].replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { chainsageColors };
