/**
 * ChainSage — design tokens as a Tailwind theme fragment (mirrors brand/tokens).
 * Design tokens only — NOT verdict logic. The verdict engine lives in
 * @chainsage/engine and is never duplicated. Theme-dependent surface colors
 * (bg, text, card) are driven by CSS variables in app/tokens.css.
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
