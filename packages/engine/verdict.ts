/**
 * ChainSage verdict primitives — the sacred three-state decision and its
 * semantic colors. Kept tiny and dependency-free so the pure risk engine
 * (risk.ts) can depend on it without dragging in any design-system weight.
 *
 * Verdict color mapping mirrors brand/tokens — ALLOW=trust, REVIEW=warning,
 * DENY=danger. These colors are reserved EXCLUSIVELY for verdict/risk state.
 */

export type Verdict = "ALLOW" | "REVIEW" | "DENY";

/** Map a verdict to its sacred semantic color token (hex from brand/tokens). */
export const verdictColor: Record<Verdict, string> = {
  ALLOW: "#34D399", // trust
  REVIEW: "#FBBF24", // warning
  DENY: "#F4534F", // danger
};
