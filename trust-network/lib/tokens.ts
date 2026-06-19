/**
 * ChainSage — Design tokens as a Tailwind theme fragment.
 * Single source of truth shared by the marketing site and the Guardian app.
 *
 * Usage (tailwind.config.ts):
 *   import { chainsageTheme } from "../brand/tokens";
 *   export default { theme: { extend: chainsageTheme } } satisfies Config;
 *
 * Theme-dependent surface colors (bg, text, card) are driven by the CSS
 * variables in tokens.css and the [data-theme] attribute — reference them via
 * `bg-[var(--bg)]` etc. so a single attribute swap re-themes the whole app.
 */

export const chainsageColors = {
  primary: "#7C5CFF",
  secondary: "#9C82FF",
  accent: "#5B8DEF",
  p3: "#B9A5FF",
  // SACRED — verdict / risk state only
  trust: "#34D399",
  warning: "#FBBF24",
  danger: "#F4534F",
  cyan: "#22D3EE",
} as const;

export const chainsageTheme = {
  colors: {
    ...chainsageColors,
    // theme-aware aliases -> CSS variables
    bg: "var(--bg)",
    "bg-2": "var(--bg-2)",
    text: "var(--text)",
    "text-2": "var(--text-2)",
    "text-3": "var(--text-3)",
    card: "var(--card)",
    "card-border": "var(--card-border)",
    hairline: "var(--hairline)",
  },
  fontFamily: {
    display: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
    mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
  },
  letterSpacing: {
    display: "-0.03em",
    tightish: "-0.02em",
    micro: "0.04em",
  },
  backgroundImage: {
    brand: "linear-gradient(135deg, #7C5CFF, #9C82FF 55%, #5B8DEF)",
  },
  borderRadius: {
    cs: "14px",
    "cs-lg": "22px",
  },
  transitionTimingFunction: {
    cs: "cubic-bezier(0.22, 1, 0.36, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} satisfies Record<string, unknown>;

export type Verdict = "ALLOW" | "REVIEW" | "DENY";

/** Map a verdict to its sacred semantic color token. */
export const verdictColor: Record<Verdict, string> = {
  ALLOW: chainsageColors.trust,
  REVIEW: chainsageColors.warning,
  DENY: chainsageColors.danger,
};
