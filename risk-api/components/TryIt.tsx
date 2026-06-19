"use client";

/**
 * Live "try it" widget — paste an address, calls POST /api/v1/score with the
 * public `demo` key, renders the verdict with the VerdictRing aesthetic. This is
 * a real call against live Base state, the same path any integrator gets.
 */
import { useState } from "react";
import { VerdictRing } from "./Verdict";
import { Scan, Spark, External } from "./Brand";

type Severity = "info" | "warn" | "danger";
interface Flag {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  basescanLink?: string;
}
interface ScoreData {
  report: {
    healthScore: number;
    verdict: "ALLOW" | "REVIEW" | "DENY";
    flags: Flag[];
    stats: {
      totalApprovals: number;
      unlimitedApprovals: number;
      freshApprovals: number;
      drainerApprovals: number;
      tokensHeld: number;
    };
  };
  meta: { scannedAt: string; blockNumber: string; chain: string };
}

const EXAMPLE = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

const sevColor: Record<Severity, string> = {
  danger: "var(--danger)",
  warn: "var(--warning)",
  info: "var(--text-3)",
};

export function TryIt() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const run = async (addr: string) => {
    const value = addr.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/v1/score", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "demo" },
        body: JSON.stringify({ address: value }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? `Request failed (${res.status}).`);
      } else {
        setData(json.data as ScoreData);
      }
    } catch {
      setError("Network error reaching the API. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cs-glass p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(address)}
            placeholder="0x… wallet address on Base"
            spellCheck={false}
            className="mono w-full rounded-cs border border-hairline bg-[var(--bg-2)] px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-text-3 focus:border-[var(--primary)]"
          />
        </div>
        <button
          onClick={() => run(address)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-cs bg-brand px-5 py-3 text-sm font-semibold text-white transition-transform ease-spring hover:scale-[1.02] disabled:opacity-60"
        >
          {loading ? <Spark size={18} className="cs-spin" /> : <Scan size={18} />}
          {loading ? "Scanning…" : "Score address"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() => {
            setAddress(EXAMPLE);
            run(EXAMPLE);
          }}
          className="mono text-xs text-text-3 underline-offset-2 hover:text-text-2 hover:underline"
        >
          try an example address
        </button>
        <span className="micro text-text-3">key: demo · live Base mainnet</span>
      </div>

      {error && (
        <div
          className="mt-5 rounded-cs border px-4 py-3 text-sm"
          style={{ borderColor: "var(--danger)", color: "var(--danger)", background: "rgba(244,83,79,0.08)" }}
        >
          {error}
        </div>
      )}

      {data && (
        <div className="mt-6 cs-fade-up">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <VerdictRing score={data.report.healthScore} verdict={data.report.verdict} />
            <div className="flex-1">
              <div className="mono grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-text-2 sm:grid-cols-3">
                <Stat label="approvals" value={data.report.stats.totalApprovals} />
                <Stat label="unlimited" value={data.report.stats.unlimitedApprovals} />
                <Stat label="fresh" value={data.report.stats.freshApprovals} />
                <Stat label="drainers" value={data.report.stats.drainerApprovals} />
                <Stat label="tokens" value={data.report.stats.tokensHeld} />
                <Stat label="block" value={data.meta.blockNumber} />
              </div>
              <div className="mt-4 space-y-2">
                {data.report.flags.map((f) => (
                  <div key={f.id} className="flex gap-2.5 rounded-cs border border-hairline bg-[var(--bg-2)] px-3 py-2.5">
                    <span
                      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: sevColor[f.severity] }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-text">{f.title}</div>
                      <div className="text-[13px] leading-relaxed text-text-2">{f.detail}</div>
                      {f.basescanLink && (
                        <a
                          href={f.basescanLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mono mt-1 inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                        >
                          BaseScan <External size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowRaw((v) => !v)}
            className="mono mt-5 text-xs text-text-3 hover:text-text-2"
          >
            {showRaw ? "▾ hide raw JSON" : "▸ show raw JSON response"}
          </button>
          {showRaw && (
            <pre className="mono mt-2 max-h-80 overflow-auto rounded-cs border border-hairline bg-[var(--bg-2)] p-4 text-[12px] leading-relaxed text-text-2">
              <code>{JSON.stringify({ ok: true, data }, null, 2)}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-hairline py-1">
      <span className="micro text-text-3">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
