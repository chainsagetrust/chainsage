# ChainSage — Brand Guide

**Trust Layer for Autonomous Finance** — the decision engine between an AI agent's intent and on-chain execution.

> Settlement moves money. Authorization grants permission. **ChainSage decides whether it should happen.**

Flow: **Agent Intent → ChainSage Verdict (ALLOW / REVIEW / DENY) → Execution.**

ChainSage is **not** a wallet, **not** a security dashboard, **not** a DeFi casino, **not** a meme/token project. It is read-only by default; keys are never touched. Aesthetic target: Stripe × Anthropic × Linear × Cursor — institutional, premium, AI-native. Avoid every crypto cliché (no shields, no neon overload, no hacker green, no hexagon-node-gateway art).

---

## 1. The Sage Mark

The mark fuses two ideas: *intent → decision → execution* **and** *a trust network*.

- A **hollow intent node** (bottom-left) flows diagonally up through a **layered-diamond verdict core** (center) to a **solid execution node** (top-right).
- A third **network node** (bottom-right) feeds the verdict core.
- The center is a **rotated layered diamond** — a verdict crystallizing. **Never a shield.**

### Files
| Asset | File | Notes |
|---|---|---|
| Primary mark | `assets/sage-mark.svg` | Full gradient mark, use everywhere |
| Favicon | `assets/favicon.svg` | **Simplified** — third branch + network node dropped for ≤32px legibility |
| Mono (dark bg) | `assets/mark-mono-dark.svg` | Single-color light mark |
| Mono (light bg) | `assets/mark-mono-light.svg` | Single-color dark mark |
| Horizontal lockup | `assets/logo-horizontal.svg` | Mark + "ChainSage" + mono tagline |
| App icon 1024 | `assets/app-icon-1024.svg` | Squircle r≈228, halo + 1px inner hairline |
| Social avatar 512 | `assets/social-avatar-512.svg` | Circular, gradient field |
| X banner 1500×500 | `assets/x-banner-1500x500.svg` | |
| Hero illustration | `assets/hero-illustration.svg` | Agent → verdict core → Execution |
| Roadmap graphic | `assets/roadmap-wedge.svg` | Rising "wedge → standard" curve |

### Clear space & sizing
- **Clear space = one node radius** (the radius of the intent node) on every side. Keep it clear of other elements.
- Minimum mark size: 20px. Below 32px use `favicon.svg` (simplified).
- Never recolor the gradient, rotate the mark, stretch it non-uniformly, add a drop shadow that isn't the brand glow, or place it on a busy photo without a scrim.

### PNG fallbacks
SVG is authoritative. Generate PNGs with `node assets/render-png.mjs` (requires `npm i sharp`). Produces favicon 16/32/64, app-icon 1024, avatar 512, banner.

---

## 2. Color

```
Primary    #7C5CFF      Secondary  #9C82FF     Accent/flow #5B8DEF     p3 #B9A5FF
Trust/safe #34D399      Warning    #FBBF24     Danger      #F4534F     cyan #22D3EE
Brand gradient: linear-gradient(135deg, #7C5CFF, #9C82FF 55%, #5B8DEF)
```

### ⛔ The sacred semantic rule
**`trust` / `warning` / `danger` are reserved EXCLUSIVELY for verdict and risk state** — ALLOW (`trust`), REVIEW (`warning`), DENY (`danger`). They are **never** decorative, never used for general UI accents, charts, or hover states. This consistency is what makes the verdict feel trustworthy. Decorative accents use `primary` / `secondary` / `accent` / `cyan` only.

### Themes
**Midnight** (default — NOT black): bg `#0A0816` / bg2 `#0E0A1E`; text `#F4F4F7` / `#A6A6B5` / `#6E6E80`; card `rgba(22,20,40,0.55)`; border `rgba(255,255,255,0.10)`.

**Aurora Light** (never pure white): bg `#F4F2FB` / `#ECEAF8`; text `#15131F` / `#54506A` / `#8B86A0`; card `rgba(255,255,255,0.62)`; border `rgba(124,92,255,0.14)`.

Glass = `backdrop-filter: blur(28px) saturate(1.4)` + 1px border + `inset 0 1px 0 rgba(255,255,255,0.08)` + `0 16px 50px rgba(0,0,0,0.55)`.

---

## 3. Typography

- **Display / UI:** Hanken Grotesk (400–900). Tight tracking on display: `-0.02em` to `-0.035em`.
- **Mono / data:** JetBrains Mono — addresses, hashes, amounts, verdict IDs, labels, code.
- **Scale:** Display 48–68 / H1 34 / H2 26 / H3 20 / Body 16 / Small 14 / Caption 13 / Micro 11 (uppercase, +0.04em).

---

## 4. Engineering handoff

Tokens are the single source of truth — do not hardcode hex values in components.

- **CSS variables:** `brand/tokens.css` — import once at the app root. Theme switches by setting `data-theme="midnight" | "aurora"` on `<html>`. Reference as `var(--primary)`, `var(--bg)`, etc.
- **Tailwind:** `brand/tokens.ts` exports `chainsageTheme` → `theme.extend`. Theme-aware colors (`bg`, `text`, `card`) map to CSS variables so one attribute swap re-themes everything.
- **Verdict helper:** `verdictColor[verdict]` and the `Verdict` type live in `tokens.ts`.
- **Reduced motion:** `tokens.css` already disables animation under `prefers-reduced-motion`. Honor it in JS-driven motion too.

### Figma variables setup
Mirror the tokens as Figma variables in two collections:
1. **Brand** (mode-independent): `primary`, `secondary`, `accent`, `p3`, `trust`, `warning`, `danger`, `cyan`.
2. **Surface** (modes: `Midnight`, `Aurora`): `bg`, `bg-2`, `text`, `text-2`, `text-3`, `card`, `card-border`, `hairline`.

Bind component fills to the variable, never a raw hex, so theme swaps are a single mode toggle.

---

## 5. Voice

Institutional, precise, confident, AI-native. Mono for anything machine-truthful (numbers, addresses, verdicts). Never hype. Claims discipline:

- Virtuals / ACP: ChainSage is **building toward** an ACP verdict service agents on Virtuals consult before executing — never "live on ACP", never "partnership". Virtuals is an agent ecosystem, not an executor — never write "Virtuals executes".
- $SAGE is **launching on Virtuals via Genesis** — no supply figures, no invented mechanics.
- Never fabricate technical integration details. State the position, not a claim.

X: **@chainsagetrust** · Domain: **chainsage.finance** · GitHub: **github.com/chainsagetrust/chainsage**
