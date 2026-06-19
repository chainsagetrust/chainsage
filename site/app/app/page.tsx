"use client";

/**
 * Guardian — the full flow: connect read-only (or paste any 0x address) → live
 * staged scan of Base mainnet → verdict screen (health-score ring, stats, the
 * "what we found" flags, and the real active-approvals table with Basescan
 * links). Every number on this screen is read live in lib/chain.ts. Nothing is
 * mocked. Guardian never moves funds — to revoke, follow the Basescan link.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { formatUnits } from "viem";
import {
  SageMark,
  Lock,
  Wallet,
  Refresh,
  External,
  Logout,
  CheckC,
  Alert,
  Ban,
  Clock,
  Arrow,
} from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VerdictRing } from "@/components/VerdictRing";
import {
  useGuardianScan,
  STAGE_LABELS,
  type ScanStage,
} from "@/components/useGuardianScan";
import { verdictColor, type Verdict } from "@/lib/tokens";
import { BASESCAN } from "@/lib/risk";

const SCAN_STAGES: ScanStage[] = ["balances", "approvals", "ages", "verdict"];

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const VERDICT_COPY: Record<Verdict, { label: string; line: string }> = {
  ALLOW: {
    label: "Clear to act",
    line: "No drainer signals. This wallet's approval surface looks healthy.",
  },
  REVIEW: {
    label: "Review before acting",
    line: "Some exposure worth pruning before you sign anything important.",
  },
  DENY: {
    label: "Do not act yet",
    line: "Dangerous approval pattern detected. Revoke the flagged spenders first.",
  },
};

export default function Page() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { stage, result, error, scan, reset } = useGuardianScan();

  const [manual, setManual] = useState("");
  const [scanned, setScanned] = useState<string | null>(null);

  // Auto-scan when a wallet connects.
  useEffect(() => {
    if (isConnected && address && scanned !== address) {
      setScanned(address);
      scan(address);
    }
  }, [isConnected, address, scanned, scan]);

  const startManual = () => {
    const v = manual.trim();
    setScanned(v);
    scan(v);
  };

  const rescan = () => {
    if (scanned) scan(scanned);
  };

  const fullReset = () => {
    reset();
    setScanned(null);
    setManual("");
    if (isConnected) disconnect();
  };

  const busy = stage !== "idle" && stage !== "done" && stage !== "error";
  const showLanding = stage === "idle";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-7 sm:px-8">
      <Header />

      {showLanding && (
        <Landing
          manual={manual}
          setManual={setManual}
          onScan={startManual}
          connect={connect}
          connectors={connectors}
          isPending={isPending}
        />
      )}

      {busy && <Scanning stage={stage} target={scanned} />}

      {stage === "error" && (
        <ErrorState message={error} onRetry={rescan} onReset={fullReset} />
      )}

      {stage === "done" && result && (
        <Verdict result={result} onRescan={rescan} onReset={fullReset} />
      )}

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ header */

function Header() {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link
        href="/"
        className="flex items-center gap-3 transition-opacity hover:opacity-80"
        aria-label="Back to ChainSage home"
      >
        <SageMark size={38} />
        <div className="leading-tight">
          <div className="text-[19px] font-extrabold tracking-tightish">
            Guardian
          </div>
          <div className="micro text-text-3">CHAINSAGE · PHASE 1</div>
        </div>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 text-text-2 sm:flex">
          <Lock size={14} />
          <span className="micro">READ-ONLY · KEYS NEVER TOUCHED</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------- landing */

function Landing({
  manual,
  setManual,
  onScan,
  connect,
  connectors,
  isPending,
}: {
  manual: string;
  setManual: (v: string) => void;
  onScan: () => void;
  connect: ReturnType<typeof useConnect>["connect"];
  connectors: ReturnType<typeof useConnect>["connectors"];
  isPending: boolean;
}) {
  const valid = /^0x[a-fA-F0-9]{40}$/.test(manual.trim());
  return (
    <section className="cs-fade-up flex flex-1 flex-col items-center justify-center py-12 text-center">
      <div className="mb-6 grid place-items-center">
        <SageMark size={84} />
      </div>
      <h1 className="max-w-2xl text-balance text-4xl font-extrabold tracking-display sm:text-5xl">
        The verdict before you sign.
      </h1>
      <p className="mt-4 max-w-xl text-text-2">
        Guardian reads your wallet live on Base — token approvals, unlimited
        allowances, and the age of every spender contract — and returns one
        verdict: <span style={{ color: verdictColor.ALLOW }}>ALLOW</span>,{" "}
        <span style={{ color: verdictColor.REVIEW }}>REVIEW</span>, or{" "}
        <span style={{ color: verdictColor.DENY }}>DENY</span>.
      </p>

      <div className="mt-9 w-full max-w-md">
        <div className="cs-glass p-5 text-left">
          <label className="micro text-text-3">SCAN ANY ADDRESS</label>
          <div className="mt-2 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && valid && onScan()}
              placeholder="0x…"
              spellCheck={false}
              className="mono w-full rounded-cs border border-card-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-text-3 focus:border-primary"
            />
            <button
              onClick={onScan}
              disabled={!valid}
              className="flex items-center gap-1.5 rounded-cs bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              Scan <Arrow size={16} />
            </button>
          </div>

          <div className="my-4 flex items-center gap-3 text-text-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="micro">OR</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <div className="flex flex-col gap-2">
            {connectors.map((c) => (
              <button
                key={c.uid}
                onClick={() => connect({ connector: c })}
                disabled={isPending}
                className="flex items-center justify-center gap-2 rounded-cs border border-card-border bg-transparent px-4 py-2.5 text-sm font-medium transition hover:border-primary disabled:opacity-50"
              >
                <Wallet size={16} /> Connect {c.name}{" "}
                <span className="micro text-text-3">(read-only)</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-text-3">
          Guardian only reads. It never requests a signature or moves funds.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- scanning */

function Scanning({ stage, target }: { stage: ScanStage; target: string | null }) {
  const activeIdx = SCAN_STAGES.indexOf(stage);
  return (
    <section className="cs-fade-up flex flex-1 flex-col items-center justify-center py-16">
      <div className="relative mb-10 grid place-items-center">
        <div
          className="absolute h-28 w-28 rounded-full"
          style={{ boxShadow: "0 0 60px 6px rgba(124,92,255,0.45)" }}
        />
        <div className="cs-spin h-20 w-20 rounded-full border-2 border-hairline border-t-primary" />
        <div className="absolute">
          <SageMark size={34} />
        </div>
      </div>
      {target && (
        <div className="mono mb-6 text-sm text-text-2">{short(target)}</div>
      )}
      <ul className="w-full max-w-sm space-y-2">
        {SCAN_STAGES.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li
              key={s}
              className={`flex items-center gap-3 rounded-cs border px-4 py-2.5 text-sm transition ${
                active
                  ? "border-primary/50 bg-primary/5 text-text"
                  : done
                    ? "border-card-border text-text-2"
                    : "border-transparent text-text-3"
              }`}
            >
              <span className="grid h-5 w-5 place-items-center">
                {done ? (
                  <span style={{ color: verdictColor.ALLOW }}>
                    <CheckC size={18} />
                  </span>
                ) : active ? (
                  <span className="cs-pulse text-primary">
                    <span className="block h-2 w-2 rounded-full bg-primary" />
                  </span>
                ) : (
                  <span className="block h-2 w-2 rounded-full bg-current opacity-40" />
                )}
              </span>
              {STAGE_LABELS[s]}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------- error */

function ErrorState({
  message,
  onRetry,
  onReset,
}: {
  message: string | null;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <section className="cs-fade-up flex flex-1 flex-col items-center justify-center py-16 text-center">
      <span style={{ color: verdictColor.DENY }}>
        <Alert size={44} />
      </span>
      <h2 className="mt-4 text-2xl font-bold">Couldn&apos;t finish the scan</h2>
      <p className="mt-3 max-w-md text-text-2">
        {message ?? "Something went wrong reading the chain."}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-cs bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          <Refresh size={16} /> Try again
        </button>
        <button
          onClick={onReset}
          className="rounded-cs border border-card-border px-4 py-2.5 text-sm hover:border-primary"
        >
          Start over
        </button>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- verdict */

import type { ScanResult } from "@/components/useGuardianScan";

function Verdict({
  result,
  onRescan,
  onReset,
}: {
  result: ScanResult;
  onRescan: () => void;
  onReset: () => void;
}) {
  const { report, approvals, address, native, tokenBalances } = result;
  const v = report.verdict;
  const color = verdictColor[v];
  const copy = VERDICT_COPY[v];

  const balanceLines = useMemo(
    () => [
      { symbol: "ETH", formatted: native.formatted },
      ...tokenBalances.map((t) => ({ symbol: t.symbol, formatted: t.formatted })),
    ],
    [native, tokenBalances]
  );

  return (
    <section className="cs-fade-up flex flex-1 flex-col gap-6 py-8">
      {/* verdict header */}
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <VerdictRing score={report.healthScore} verdict={v} size={170} />
          <div>
            <div className="micro" style={{ color }}>
              VERDICT
            </div>
            <div className="text-3xl font-extrabold tracking-display" style={{ color }}>
              {v}
            </div>
            <div className="mt-1 font-semibold">{copy.label}</div>
            <p className="mt-1 max-w-xs text-sm text-text-2">{copy.line}</p>
            <div className="mono mt-3 flex items-center gap-2 text-xs text-text-3">
              <Wallet size={13} /> {short(address)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRescan}
            className="flex items-center gap-1.5 rounded-cs border border-card-border px-3.5 py-2 text-sm hover:border-primary"
          >
            <Refresh size={15} /> Re-scan
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-cs border border-card-border px-3.5 py-2 text-sm hover:border-primary"
          >
            <Logout size={15} /> New scan
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active approvals" value={report.stats.totalApprovals} />
        <Stat
          label="Unlimited"
          value={report.stats.unlimitedApprovals}
          warn={report.stats.unlimitedApprovals > 0}
        />
        <Stat
          label="Fresh contracts"
          value={report.stats.freshApprovals}
          danger={report.stats.freshApprovals > 0}
        />
        <Stat label="Tokens held" value={report.stats.tokensHeld} />
      </div>

      {/* flags */}
      <div>
        <h3 className="mb-3 text-lg font-bold">What we found</h3>
        <div className="space-y-2.5">
          {report.flags.map((f) => (
            <FlagRow key={f.id} flag={f} />
          ))}
        </div>
      </div>

      {/* approvals table */}
      <div>
        <h3 className="mb-1 text-lg font-bold">Active approvals</h3>
        <p className="mb-3 text-sm text-text-3">
          Live allowances re-read from Base. Guardian never moves funds — revoke
          on Basescan.
        </p>
        {approvals.length === 0 ? (
          <div className="cs-glass p-6 text-center text-sm text-text-2">
            No active token approvals on this wallet. Clean surface.
          </div>
        ) : (
          <div className="cs-glass overflow-hidden">
            <div className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2 border-b border-hairline px-4 py-2.5 text-text-3">
              <span className="micro">TOKEN</span>
              <span className="micro">SPENDER</span>
              <span className="micro">ALLOWANCE</span>
              <span className="micro text-right">REVOKE</span>
            </div>
            {approvals.map((a) => (
              <div
                key={`${a.token}-${a.spender}`}
                className="grid grid-cols-[1fr_1.4fr_1fr_auto] items-center gap-2 border-b border-hairline px-4 py-3 text-sm last:border-0"
              >
                <span className="mono font-medium">{a.tokenSymbol}</span>
                <a
                  href={BASESCAN + a.spender}
                  target="_blank"
                  rel="noreferrer"
                  className="mono truncate text-text-2 hover:text-primary"
                >
                  {short(a.spender)}
                </a>
                <span className="mono">
                  {a.isUnlimited ? (
                    <span style={{ color: verdictColor.REVIEW }}>Unlimited</span>
                  ) : (
                    Number(
                      formatUnits(a.allowance, a.tokenDecimals)
                    ).toLocaleString(undefined, { maximumFractionDigits: 4 })
                  )}
                </span>
                <a
                  href={BASESCAN + a.spender}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-end gap-1 text-text-3 hover:text-primary"
                  title="Open spender on Basescan to revoke"
                >
                  <External size={15} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* held balances (small, for transparency that data is live) */}
      <div className="flex flex-wrap gap-2">
        {balanceLines
          .filter((b) => Number(b.formatted) > 0)
          .map((b) => (
            <span
              key={b.symbol}
              className="mono rounded-full border border-card-border px-3 py-1 text-xs text-text-2"
            >
              {Number(b.formatted).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {b.symbol}
            </span>
          ))}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  warn,
  danger,
}: {
  label: string;
  value: number;
  warn?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? verdictColor.DENY
    : warn
      ? verdictColor.REVIEW
      : undefined;
  return (
    <div className="cs-glass px-4 py-3.5">
      <div
        className="mono text-2xl font-semibold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="micro mt-1 text-text-3">{label}</div>
    </div>
  );
}

function FlagRow({
  flag,
}: {
  flag: import("@/lib/risk").Flag;
}) {
  const tint =
    flag.severity === "danger"
      ? verdictColor.DENY
      : flag.severity === "warn"
        ? verdictColor.REVIEW
        : verdictColor.ALLOW;
  const Glyph =
    flag.severity === "danger" ? Ban : flag.severity === "warn" ? Alert : CheckC;
  return (
    <div className="cs-glass flex gap-3 p-4">
      <span className="mt-0.5 shrink-0" style={{ color: tint }}>
        <Glyph size={20} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-semibold">{flag.title}</div>
        <p className="mt-1 text-sm text-text-2">{flag.detail}</p>
        {flag.basescanLink && (
          <a
            href={flag.basescanLink}
            target="_blank"
            rel="noreferrer"
            className="mono mt-2 inline-flex items-center gap-1 text-xs text-text-3 hover:text-primary"
          >
            <Clock size={12} /> {flag.spender ? short(flag.spender) : "view"}{" "}
            <External size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ footer */

function Footer() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-1 border-t border-hairline pt-6 text-center text-xs text-text-3">
      <div className="flex items-center gap-2">
        <SageMark size={18} />
        <span>ChainSage Guardian — the trust layer for autonomous finance.</span>
      </div>
      <span className="mono">
        Read-only · Base mainnet · keys never touched · no funds ever moved
      </span>
    </footer>
  );
}
