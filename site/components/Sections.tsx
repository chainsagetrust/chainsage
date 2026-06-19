"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, StaggerGroup, staggerChild } from "./motion";
import { SectionHeading, GlassCard } from "./ui";
import { SageMark } from "./SageMark";
import { StatusBadge, type RouteStatus } from "./StatusBadge";
import { verdictColor, verdictRgba } from "@/lib/verdict";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ===================================================== 3. The Missing Layer */

const LAYERS = [
  {
    tag: "Settlement",
    role: "moves money",
    body: "Stablecoins, rollups, and payment rails moved value on-chain in seconds. Solved.",
    solved: true,
  },
  {
    tag: "Authorization",
    role: "grants permission",
    body: "Account abstraction, session keys, and x402 let agents hold and spend. Solved.",
    solved: true,
  },
  {
    tag: "Decision",
    role: "decides if it should happen",
    body: "Nothing asks the one question that matters before an agent signs: should this transaction happen at all?",
    solved: false,
  },
];

export function MissingLayer() {
  return (
    <section id="missing-layer" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="The missing layer"
          title={
            <>
              Two layers shipped.{" "}
              <span className="cs-gradient-text">The third is still missing.</span>
            </>
          }
          intro="Autonomous finance can already move money and grant agents permission to spend it. What it can't do is decide whether a given action should be allowed."
        />
      </Reveal>

      <StaggerGroup className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {LAYERS.map((l) => (
          <motion.div key={l.tag} variants={staggerChild}>
            <GlassCard
              className={`relative h-full p-6 ${
                !l.solved
                  ? "ring-1 ring-[var(--primary)]/40"
                  : ""
              }`}
            >
              {!l.solved && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-[var(--radius-lg)]"
                  style={{
                    boxShadow: "0 0 50px rgba(124,92,255,0.35)",
                  }}
                  animate={{ opacity: [0.4, 0.85, 0.4], y: [0, -4, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold text-text">
                    {l.tag}
                  </span>
                  <span
                    className="font-mono text-[0.62rem] uppercase tracking-[0.1em]"
                    style={{
                      color: l.solved ? "var(--text-3)" : verdictColor.REVIEW,
                    }}
                  >
                    {l.solved ? "shipped" : "missing"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[0.78rem] text-text-3">
                  {l.role}
                </p>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-text-2">
                  {l.body}
                </p>
                {!l.solved && (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-1">
                    <SageMark size={16} />
                    <span className="font-mono text-[0.7rem] text-text">
                      ChainSage
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}

/* ========================================================= 4. How it Works */

const PIPELINE = [
  { step: "01", name: "Agent Intent", desc: "An agent proposes a transaction." },
  { step: "02", name: "Simulation", desc: "Execute it in a fork — see the real outcome before it happens." },
  { step: "03", name: "Risk Engine", desc: "Score approvals, drainers, contract age, and value at risk." },
  { step: "04", name: "Policy Engine", desc: "Check the action against the owner's runtime rules." },
  { step: "05", name: "Trust Network", desc: "Weigh the counterparties' shared reputation." },
  { step: "06", name: "Verdict", desc: "ALLOW · REVIEW · DENY — one decision, with reasons." },
  { step: "07", name: "Execution", desc: "Only an ALLOW (or confirmed REVIEW) ever reaches the chain." },
];

export function HowItWorks() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(
      () => setActive((a) => (a + 1) % PIPELINE.length),
      1100,
    );
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <section id="how" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="One pipeline, from intent to execution"
          intro="Every agent action walks the same seven steps. The verdict is the gate — execution only happens on the far side of a decision."
        />
      </Reveal>

      <div className="relative mt-14">
        {/* spine */}
        <div className="absolute left-[1.35rem] top-2 bottom-2 w-px bg-[var(--hairline)] sm:left-[1.6rem]" />
        <ul className="space-y-3">
          {PIPELINE.map((p, i) => {
            const isActive = i === active;
            const isGate = p.name === "Verdict";
            return (
              <Reveal as="li" key={p.step} delay={i * 0.04}>
                <div
                  className="relative flex items-start gap-4 rounded-2xl border p-4 transition-colors duration-300"
                  style={{
                    borderColor: isActive
                      ? "var(--primary)"
                      : "var(--card-border)",
                    background: isActive
                      ? "rgba(124,92,255,0.08)"
                      : "var(--card)",
                  }}
                >
                  <div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center">
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      animate={{
                        boxShadow: isActive
                          ? "0 0 22px rgba(124,92,255,0.6)"
                          : "0 0 0 rgba(0,0,0,0)",
                      }}
                    />
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full border font-mono text-[0.7rem] font-semibold"
                      style={{
                        borderColor: isActive
                          ? "var(--primary)"
                          : "var(--card-border)",
                        background: "var(--bg-2)",
                        color: isActive ? "var(--text)" : "var(--text-3)",
                      }}
                    >
                      {p.step}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-text">
                        {p.name}
                      </span>
                      {isGate && (
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-3">
                          the gate
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[0.92rem] leading-relaxed text-text-2">
                      {p.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ============================================================= 6. Roadmap */

const PHASES: {
  n: string;
  name: string;
  color: string;
  body: string;
  href: string;
  status: RouteStatus;
}[] = [
  {
    n: "01",
    name: "Guardian",
    color: "#34D399",
    href: "/app",
    body: "Consumer wallet protection — read-only approval & drainer analysis. Live on Base today.",
    status: "LIVE",
  },
  {
    n: "02",
    name: "Risk API",
    color: "#22D3EE",
    href: "/developers",
    body: "The verdict engine as embeddable HTTP infrastructure for any app or wallet.",
    status: "DOCS",
  },
  {
    n: "03",
    name: "Agent SDK",
    color: "#5B8DEF",
    href: "/developers",
    body: "chainsage.check(intent) — one fail-safe call before every signature.",
    status: "DOCS",
  },
  {
    n: "04",
    name: "Policy Engine",
    color: "#7C5CFF",
    href: "/policy",
    body: "Owner-defined runtime rules — limits, allowlists, escalation. Build a policy and replay sample actions against the real engine.",
    status: "PREVIEW",
  },
  {
    n: "05",
    name: "Trust Network",
    color: "#9C82FF",
    href: "/network",
    body: "Shared reputation across agents and contracts. Explore the live graph and simulate a drainer incident.",
    status: "PREVIEW",
  },
];

export function Roadmap() {
  return (
    <section id="roadmap" className="mx-auto max-w-5xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="The product"
          title="From a consumer guardian to a category standard"
          intro="Five phases, each a route you can open now. Guardian is live on Base; the SDK and Risk API ship as developer docs; the Policy Engine and Trust Network are explorable previews running on real, tested engines."
        />
      </Reveal>

      <div className="mt-14 space-y-4">
        {PHASES.map((p, i) => (
          <Reveal key={p.n} delay={i * 0.05}>
            <Link href={p.href} className="group block">
              <GlassCard className="flex flex-col gap-4 p-5 transition-colors group-hover:border-[var(--primary)]/50 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4 sm:w-64 sm:shrink-0">
                  <span
                    className="font-mono text-2xl font-bold"
                    style={{ color: p.color }}
                  >
                    {p.n}
                  </span>
                  <span className="font-display text-xl font-bold text-text">
                    {p.name}
                  </span>
                </div>
                <p className="flex-1 text-[0.95rem] leading-relaxed text-text-2">
                  {p.body}
                </p>
                <div className="flex items-center gap-3 self-start sm:self-center">
                  <StatusBadge status={p.status} />
                  <span
                    aria-hidden
                    className="font-mono text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-text"
                  >
                    →
                  </span>
                </div>
              </GlassCard>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============================================================== 8. Why Now */

const SIGNALS = [
  {
    tag: "x402",
    body: "HTTP-native payments let agents pay per request. Money now moves at machine speed.",
  },
  {
    tag: "AP2",
    body: "Agent Payments Protocol standardizes how agents authorize and settle on a user's behalf.",
  },
  {
    tag: "Agent Protocols",
    body: "Autonomous agents are gaining wallets, mandates, and the ability to act without a human in the loop.",
  },
  {
    tag: "ChainSage",
    body: "The judgment layer those rails are missing — the verdict between an agent's intent and the chain.",
    highlight: true,
  },
];

export function WhyNow() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="Why now"
          title={
            <>
              The rails are here.{" "}
              <span className="cs-gradient-text">The judgment isn&apos;t.</span>
            </>
          }
          intro="Agents can now hold money and spend it autonomously. Every new protocol makes execution faster — and the missing decision layer more urgent."
        />
      </Reveal>

      <StaggerGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {SIGNALS.map((s) => (
          <motion.div key={s.tag} variants={staggerChild}>
            <GlassCard
              className={`h-full p-5 ${
                s.highlight ? "ring-1 ring-[var(--primary)]/50" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {s.highlight && <SageMark size={18} />}
                <span
                  className="font-mono text-sm font-semibold"
                  style={{ color: s.highlight ? undefined : "var(--accent)" }}
                >
                  {s.highlight ? (
                    <span className="cs-gradient-text">{s.tag}</span>
                  ) : (
                    s.tag
                  )}
                </span>
              </div>
              <p className="mt-3 text-[0.9rem] leading-relaxed text-text-2">
                {s.body}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </StaggerGroup>
    </section>
  );
}

/* =============================================== 9. Integrated with Bankr */

export function Bankr() {
  const reduce = useReducedMotion();
  return (
    <section id="bankr" className="mx-auto max-w-5xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="Integrated with Bankr"
          title="Execution, meet judgment."
          intro="Bankr executes. ChainSage decides. Together they close the loop — an agent that can act, and a verdict that says whether it should."
        />
      </Reveal>

      <Reveal delay={0.1}>
        <GlassCard className="mt-12 p-7 sm:p-10">
          <div className="mb-8 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.12em]"
              style={{
                color: verdictColor.REVIEW,
                background: verdictRgba("REVIEW", 0.12),
                border: `1px solid ${verdictRgba("REVIEW", 0.4)}`,
              }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              Building now
            </span>
          </div>

          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            {/* Bankr node */}
            <div className="flex-1 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-2)]/60 p-5 text-center">
              <div className="font-display text-lg font-bold text-text">Bankr</div>
              <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-text-3">
                agent · executes
              </div>
            </div>

            {/* verdict gate */}
            <div className="flex flex-col items-center gap-2 px-2">
              <motion.div
                className="font-mono text-text-3"
                animate={reduce ? undefined : { x: [-3, 3, -3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                →
              </motion.div>
              <div className="flex gap-1.5">
                {(["ALLOW", "REVIEW", "DENY"] as const).map((v) => (
                  <span
                    key={v}
                    className="rounded-md px-2 py-0.5 font-mono text-[0.58rem] font-bold"
                    style={{
                      color: verdictColor[v],
                      background: verdictRgba(v, 0.14),
                      border: `1px solid ${verdictRgba(v, 0.4)}`,
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            {/* ChainSage node */}
            <div className="flex-1 rounded-2xl border border-[var(--primary)]/40 bg-[var(--primary)]/8 p-5 text-center">
              <div className="flex items-center justify-center gap-2">
                <SageMark size={20} />
                <span className="font-display text-lg font-bold text-text">
                  ChainSage
                </span>
              </div>
              <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-text-3">
                trust layer · decides
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[0.95rem] text-text-2">
            <span className="font-mono text-text">$SAGE</span> launches natively
            on Bankr. Integration is in progress — we&apos;re building it
            together.
          </p>
        </GlassCard>
      </Reveal>
    </section>
  );
}

/* ================================================================ Footer */

const PRODUCT = [
  { label: "Guardian", href: "/app" },
  { label: "Policy Engine", href: "/policy" },
  { label: "Trust Network", href: "/network" },
  { label: "Risk API & SDK", href: "/developers" },
];

const COMPANY = [
  { label: "Developers", href: "/developers" },
  { label: "GitHub", href: "https://github.com/chainsagetrust/chainsage", external: true },
  { label: "X", href: "https://x.com/chainsagetrust", external: true },
  { label: "Launch App", href: "/app" },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <SageMark size={30} />
            <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
              ChainSage
            </span>
          </div>
          <p className="mt-4 max-w-sm font-mono text-[0.8rem] leading-relaxed text-text-2">
            Settlement moves money. Authorization grants permission. ChainSage
            decides whether it should happen.
          </p>
          <p className="mt-4 font-mono text-[0.7rem] text-text-3">
            chainsage.finance · @chainsagetrust
          </p>
        </div>

        <FooterCol title="Product" links={PRODUCT} />
        <FooterCol title="Company" links={COMPANY} />
      </div>

      <div className="mx-auto mt-12 max-w-6xl border-t border-[var(--hairline)] pt-6">
        <p className="font-mono text-[0.7rem] text-text-3">
          © 2026 ChainSage · Trust layer for autonomous finance · Read-only by
          default. Keys never touched.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-text-3">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              {...(l.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className="text-[0.9rem] text-text-2 transition-colors hover:text-text"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
