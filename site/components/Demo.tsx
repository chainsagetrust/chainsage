"use client";

/**
 * Interactive Demo — a realistic "ChainSage Agent" product UI. The chat is
 * functional: messages are intent-routed to canned, illustrative replies. This
 * is a DEMO (clearly canned content), never presented as live product data.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "./motion";
import { SectionHeading } from "./ui";
import { SageMark } from "./SageMark";
import { verdictColor, verdictRgba, type Verdict } from "@/lib/verdict";

/* ----------------------------------------------------------- portfolio data */

const WALLET = "0x3a4f…d9c2";
const TOKENS = [
  { sym: "ETH", name: "Ethereum", val: "$11,240", chg: +5.2, color: "#627EEA" },
  { sym: "USDC", name: "USD Coin", val: "$8,300", chg: +0.0, color: "#2775CA" },
  { sym: "ARB", name: "Arbitrum", val: "$3,180", chg: +9.4, color: "#28A0F0" },
  { sym: "UNI", name: "Uniswap", val: "$2,110", chg: -2.1, color: "#FF007A" },
];
const NAV = ["Portfolio", "Tx guardian", "DeFi advisor", "Tx history"];

/* ------------------------------------------------------------ message model */

type RiskRow = { label: string; value: string; verdict: Verdict };
type Msg =
  | { id: number; role: "user"; kind: "text"; text: string }
  | { id: number; role: "agent"; kind: "text"; text: string }
  | { id: number; role: "agent"; kind: "risk"; text: string; rows: RiskRow[] }
  | {
      id: number;
      role: "agent";
      kind: "verdict";
      text: string;
      verdict: Verdict;
      detail: string;
    }
  | { id: number; role: "agent"; kind: "yield"; text: string }
  | { id: number; role: "agent"; kind: "recap"; text: string };

const CHIPS = [
  "Wallet recap",
  "Best USDC yields",
  "Simulate swap",
  "Risk check",
];

let nextId = 100;

// Distributive omit so each union member keeps its own discriminated shape.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type AgentReply = DistributiveOmit<Extract<Msg, { role: "agent" }>, "id">;

function route(input: string): AgentReply {
  const q = input.toLowerCase();
  if (/risk|safe|approval|drain|scam|check/.test(q)) {
    return {
      role: "agent",
      kind: "risk",
      text: "I scanned this wallet's approvals and counterparties. Here's the breakdown:",
      rows: [
        { label: "Unlimited approvals", value: "1 · USDC → Aave v3", verdict: "ALLOW" },
        { label: "Fresh-contract exposure", value: "none", verdict: "ALLOW" },
        { label: "Approval surface", value: "4 active", verdict: "ALLOW" },
        { label: "Unknown spender", value: "0x9f…b2 (unverified)", verdict: "REVIEW" },
      ],
    };
  }
  if (/yield|apy|earn|stake|aave|lend|usdc yield/.test(q)) {
    return {
      role: "agent",
      kind: "yield",
      text: "Best risk-adjusted USDC yield for this wallet right now:",
    };
  }
  if (/swap|trade|simulate|sell|buy|bridge/.test(q)) {
    return {
      role: "agent",
      kind: "verdict",
      text: "Simulated the swap on a fork before anything touches the chain:",
      verdict: "ALLOW",
      detail: "Swap 2 ETH → 5,184 USDC · Uniswap v3 · slippage 0.4% · known router · no policy breach.",
    };
  }
  if (/recap|portfolio|holdings|balance|overview|summary/.test(q)) {
    return {
      role: "agent",
      kind: "recap",
      text: "Here's where this wallet stands today.",
    };
  }
  return {
    role: "agent",
    kind: "text",
    text: "I can read this wallet's holdings, scan its approvals for drainer risk, find the safest yield, or simulate a swap before you sign. Try one of the chips below, or ask about a specific token or move.",
  };
}

const SEED: Msg[] = [
  {
    id: 1,
    role: "agent",
    kind: "text",
    text: "Hey — I'm your ChainSage Agent. I read this wallet live and give you a verdict before you act. Ask me anything, or tap a suggestion.",
  },
  {
    id: 2,
    role: "agent",
    kind: "risk",
    text: "Quick risk check on your wallet:",
    rows: [
      { label: "Unlimited approvals", value: "1 · USDC → Aave v3", verdict: "ALLOW" },
      { label: "Fresh-contract exposure", value: "none", verdict: "ALLOW" },
      { label: "Unknown spender", value: "0x9f…b2 (unverified)", verdict: "REVIEW" },
    ],
  },
];

export function Demo() {
  const reduce = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typing]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    setInput("");
    setMsgs((m) => [...m, { id: ++nextId, role: "user", kind: "text", text }]);
    setTyping(true);
    const reply = route(text);
    const delay = reduce ? 200 : 850;
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { ...reply, id: ++nextId } as Msg]);
    }, delay);
  };

  return (
    <section id="demo" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <SectionHeading
          eyebrow="Interactive demo"
          title="Meet your ChainSage Agent"
          intro="A wallet copilot that reads your holdings, scores every move, and answers with a verdict — not just a number. Try it."
        />
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-12 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[var(--card)] shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
            {/* sidebar — hidden on mobile */}
            <aside className="hidden flex-col border-r border-[var(--hairline)] bg-[var(--bg-2)]/50 p-4 md:flex">
              <div className="flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--trust)]" />
                <span className="font-mono text-[0.72rem] text-text-2">{WALLET}</span>
              </div>

              <div className="mt-5">
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-3">
                  Total value
                </div>
                <div className="mt-1 font-display text-2xl font-extrabold text-text">
                  $24,830
                </div>
                <div className="font-mono text-[0.72rem]" style={{ color: verdictColor.ALLOW }}>
                  ▲ +4.7% today
                </div>
              </div>

              <div className="mt-5 space-y-1.5">
                {TOKENS.map((t) => (
                  <div
                    key={t.sym}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--hairline)]"
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[0.6rem] font-bold text-white"
                      style={{ background: t.color }}
                    >
                      {t.sym.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[0.78rem] text-text">{t.sym}</div>
                      <div className="truncate font-mono text-[0.62rem] text-text-3">
                        {t.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[0.74rem] text-text">{t.val}</div>
                      <div
                        className="font-mono text-[0.62rem]"
                        style={{
                          color:
                            t.chg > 0
                              ? verdictColor.ALLOW
                              : t.chg < 0
                                ? verdictColor.DENY
                                : "var(--text-3)",
                        }}
                      >
                        {t.chg > 0 ? "+" : ""}
                        {t.chg.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <nav className="mt-auto space-y-0.5 pt-5">
                {NAV.map((n, i) => (
                  <button
                    key={n}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-[0.74rem] transition-colors"
                    style={{
                      color: i === 1 ? "var(--text)" : "var(--text-3)",
                      background: i === 1 ? "var(--hairline)" : "transparent",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </nav>
            </aside>

            {/* chat */}
            <div className="flex h-[34rem] flex-col">
              {/* header */}
              <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-5 py-3.5 md:justify-start justify-center">
                <SageMark size={26} />
                <div>
                  <div className="font-display text-[0.95rem] font-bold text-text">
                    ChainSage Agent
                  </div>
                  <div className="font-mono text-[0.62rem] text-text-3">
                    Powered by ChainSage Trust Layer
                  </div>
                </div>
              </div>

              {/* messages */}
              <div ref={scrollRef} className="cs-scroll flex-1 space-y-3 overflow-y-auto px-4 py-5">
                {msgs.map((m) => (
                  <Bubble key={m.id} m={m} />
                ))}
                {typing && <TypingDots />}
              </div>

              {/* chips — order-last on mobile so they sit at the bottom */}
              <div className="flex flex-wrap gap-2 border-t border-[var(--hairline)] px-4 py-3">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="rounded-full border border-[var(--card-border)] bg-[var(--bg-2)]/60 px-3 py-1.5 font-mono text-[0.72rem] text-text-2 transition-colors hover:border-[var(--primary)] hover:text-text"
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* input — hidden on mobile per spec */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="hidden items-center gap-2 border-t border-[var(--hairline)] px-4 py-3 md:flex"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your wallet, a token, or a DeFi move…"
                  className="flex-1 bg-transparent font-sans text-[0.9rem] text-text outline-none placeholder:text-text-3"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="grid h-9 w-9 place-items-center rounded-full text-white transition-transform hover:scale-105 disabled:opacity-40 [background:var(--brand-gradient)]"
                  aria-label="Send"
                >
                  ↑
                </button>
              </form>
            </div>
          </div>
        </div>
      </Reveal>
      <p className="mt-3 text-center font-mono text-[0.66rem] text-text-3">
        Illustrative demo · canned responses · not connected to a live wallet
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- bubbles */

function Bubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed ${
          isUser
            ? "bg-[var(--primary)]/20 text-text"
            : "border border-[var(--card-border)] bg-[var(--bg-2)]/60 text-text-2"
        }`}
      >
        <p>{m.text}</p>
        {m.role === "agent" && m.kind === "risk" && <RiskCard rows={m.rows} />}
        {m.role === "agent" && m.kind === "verdict" && (
          <VerdictCard verdict={m.verdict} detail={m.detail} />
        )}
        {m.role === "agent" && m.kind === "yield" && <YieldCard />}
        {m.role === "agent" && m.kind === "recap" && <RecapCard />}
      </div>
    </motion.div>
  );
}

function RiskCard({ rows }: { rows: RiskRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[var(--card-border)]">
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`flex items-center justify-between gap-3 px-3 py-2 ${
            i > 0 ? "border-t border-[var(--hairline)]" : ""
          }`}
        >
          <div className="min-w-0">
            <div className="font-mono text-[0.72rem] text-text">{r.label}</div>
            <div className="truncate font-mono text-[0.66rem] text-text-3">
              {r.value}
            </div>
          </div>
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.58rem] font-bold"
            style={{
              color: verdictColor[r.verdict],
              background: verdictRgba(r.verdict, 0.14),
            }}
          >
            {r.verdict}
          </span>
        </div>
      ))}
    </div>
  );
}

function VerdictCard({ verdict, detail }: { verdict: Verdict; detail: string }) {
  return (
    <div
      className="mt-3 rounded-xl p-3"
      style={{
        background: verdictRgba(verdict, 0.1),
        border: `1px solid ${verdictRgba(verdict, 0.4)}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 font-mono text-[0.66rem] font-bold tracking-[0.08em]"
          style={{ color: verdictColor[verdict], background: verdictRgba(verdict, 0.18) }}
        >
          {verdict}
        </span>
        <span className="font-mono text-[0.66rem] text-text-3">cleared to execute</span>
      </div>
      <p className="mt-2 font-mono text-[0.7rem] leading-relaxed text-text-2">{detail}</p>
    </div>
  );
}

function YieldCard() {
  return (
    <div className="mt-3 rounded-xl border border-[var(--card-border)] p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.78rem] text-text">Aave v3 · USDC</span>
        <span className="font-mono text-sm font-bold" style={{ color: verdictColor.ALLOW }}>
          5.1% APY
        </span>
      </div>
      <p className="mt-2 font-mono text-[0.68rem] leading-relaxed text-text-3">
        Verified market · established contract · your 8,300 USDC would earn ~$423/yr.
        Verdict: <span style={{ color: verdictColor.ALLOW }}>ALLOW</span>.
      </p>
    </div>
  );
}

function RecapCard() {
  return (
    <div className="mt-3 rounded-xl border border-[var(--card-border)] p-3">
      <div className="font-display text-lg font-extrabold text-text">$24,830</div>
      <div className="font-mono text-[0.66rem]" style={{ color: verdictColor.ALLOW }}>
        ▲ +4.7% today
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOKENS.map((t) => (
          <span
            key={t.sym}
            className="rounded-full border border-[var(--card-border)] px-2 py-0.5 font-mono text-[0.62rem] text-text-2"
          >
            {t.sym} {t.val}
          </span>
        ))}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-2)]/60 px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-text-3"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
    </div>
  );
}
