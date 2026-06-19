import type { Metadata } from "next";
import Link from "next/link";
import { SageMark } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * /developers — DOCS hub for the two developer-facing surfaces: the Risk API
 * (HTTP) and the Agent SDK (npm package `chainsage`). This is a server-rendered
 * documentation page, not a fake product UI. The content is the REAL usage of
 * the verified risk-api workspace and the chainsage SDK; what is NOT yet real is
 * a hosted, managed endpoint with issued keys — that is called out honestly.
 */
export const metadata: Metadata = {
  title: { absolute: "ChainSage for Developers — Risk API & Agent SDK" },
  description:
    "Developer docs for ChainSage: the Risk API (HTTP verdicts) and the chainsage Agent SDK (cs.check / cs.guard). Built on the same verdict engine as Guardian.",
};

function Code({ children }: { children: string }) {
  return (
    <pre className="cs-glass mono overflow-x-auto rounded-cs p-4 text-[0.82rem] leading-relaxed text-text-2">
      {children}
    </pre>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono rounded border border-card-border px-1.5 py-0.5 text-xs text-text-2">
      {children}
    </span>
  );
}

export default function DevelopersPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-7 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
          aria-label="Back to ChainSage home"
        >
          <SageMark size={38} />
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-extrabold tracking-tightish">
                Developers
              </span>
              <StatusBadge status="DOCS" />
            </div>
            <div className="micro text-text-3">CHAINSAGE · RISK API + AGENT SDK</div>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      <section className="cs-fade-up mt-10">
        <h1 className="max-w-2xl text-balance text-3xl font-extrabold tracking-display sm:text-4xl">
          Get a verdict before your agent signs.
        </h1>
        <p className="mt-4 max-w-2xl text-text-2">
          Two ways to call the same engine that powers{" "}
          <Link href="/app" className="text-primary hover:underline">
            Guardian
          </Link>
          : an <strong>HTTP Risk API</strong> for any stack, and a TypeScript{" "}
          <strong>Agent SDK</strong> for agents that sign. Both return one verdict —{" "}
          <span style={{ color: "var(--trust)" }}>ALLOW</span> ·{" "}
          <span style={{ color: "var(--warning)" }}>REVIEW</span> ·{" "}
          <span style={{ color: "var(--danger)" }}>DENY</span> — grounded in live Base reads.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-text-3">
          Honest status: the engine and both interfaces are real and tested. There is{" "}
          <strong>not yet a hosted, managed API with issued keys</strong> — today you run the
          Risk API from the <Pill>risk-api</Pill> workspace (auth &amp; rate-limit are
          documented stubs), and the SDK runs in local mode against your own RPC. A managed
          endpoint and key issuance are building.
        </p>
      </section>

      {/* Risk API ------------------------------------------------------------ */}
      <section className="mt-12">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Risk API</h2>
          <StatusBadge status="DOCS" />
        </div>
        <p className="mt-2 max-w-2xl text-text-2">
          HTTP verdicts for any language. All endpoints are <Pill>POST</Pill>, versioned under{" "}
          <Pill>/api/v1</Pill>, authenticated with an <Pill>x-api-key</Pill> header, and return
          the envelope <Pill>{`{ ok, data | error }`}</Pill>.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              path: "/api/v1/score",
              desc: "Full wallet report — healthScore, verdict, flags[], stats. Guardian's exact scan path.",
            },
            {
              path: "/api/v1/classify",
              desc: "Risk classification for a single spender from on-chain reads.",
            },
            {
              path: "/api/v1/simulate",
              desc: "Pre-sign verdict for an approve/transfer intent, with an explicit notChecked[].",
            },
          ].map((e) => (
            <div key={e.path} className="cs-glass p-4">
              <div className="mono text-sm font-semibold text-text">{e.path}</div>
              <p className="mt-1.5 text-sm text-text-2">{e.desc}</p>
            </div>
          ))}
        </div>

        <h3 className="mb-2 mt-6 font-semibold">Example — score a wallet</h3>
        <Code>{`curl -s https://your-host/api/v1/score \\
  -H "x-api-key: demo" \\
  -H "content-type: application/json" \\
  -d '{ "address": "0xYourWallet" }'

# → { "ok": true, "data": { "report": { "healthScore": 82,
#       "verdict": "REVIEW", "flags": [ ... ], "stats": { ... } } } }`}</Code>
        <p className="mt-3 text-sm text-text-3">
          The public <Pill>demo</Pill> key and the in-memory rate-limiter are deliberate stubs
          for local use; Redis/Upstash and a real key store are the production upgrades
          (documented in the <Pill>risk-api</Pill> README).
        </p>
      </section>

      {/* Agent SDK ----------------------------------------------------------- */}
      <section className="mt-12">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Agent SDK</h2>
          <StatusBadge status="DOCS" />
        </div>
        <p className="mt-2 max-w-2xl text-text-2">
          The <Pill>chainsage</Pill> npm package. One call returns a verdict; it{" "}
          <strong>fails safe</strong> — a network error or timeout never yields a silent ALLOW.
        </p>

        <h3 className="mb-2 mt-5 font-semibold">Install</h3>
        <Code>{`npm install chainsage viem`}</Code>

        <h3 className="mb-2 mt-5 font-semibold">check() — ask for a verdict</h3>
        <Code>{`import { ChainSage } from "chainsage";

const cs = new ChainSage();            // local mode by default
const verdict = await cs.check({
  kind: "approve",
  chain: "base",
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  spender: "0x…",
  amount: "unlimited",
  owner: "0x…",
});

verdict.decision;   // "ALLOW" | "REVIEW" | "DENY"
verdict.score;      // 0–100, always inside the band for decision
verdict.reasons;    // why — each maps to a real check
verdict.notChecked; // what was NOT verified (no fabricated checks)`}</Code>

        <h3 className="mb-2 mt-5 font-semibold">guard() — only execute on ALLOW</h3>
        <Code>{`import { ChainSage, ChainSageDenied, ChainSageReview } from "chainsage";

const cs = new ChainSage();
try {
  await cs.guard(intent, () => wallet.signAndSend(tx)); // runs ONLY if ALLOW
} catch (e) {
  if (e instanceof ChainSageDenied) { /* blocked — verdict on e.verdict */ }
  if (e instanceof ChainSageReview) { /* held for a human */ }
}`}</Code>

        <div className="cs-glass mt-5 p-4">
          <div className="font-semibold">The fail-safe guarantee</div>
          <p className="mt-1.5 text-sm text-text-2">
            A trust layer that fails open is worse than none. <Pill>check()</Pill> never returns
            ALLOW when it could not actually compute a verdict — any read failure or timeout
            produces a non-ALLOW <Pill>failSafe</Pill> verdict (default REVIEW, or DENY to
            fail-closed). This is enforced by a mandatory test that injects a throwing fetch.
          </p>
        </div>
      </section>

      <footer className="mt-14 flex flex-col items-center gap-1 border-t border-hairline pt-6 text-center text-xs text-text-3">
        <div className="flex items-center gap-2">
          <SageMark size={18} />
          <span>ChainSage — the trust layer for autonomous finance.</span>
        </div>
        <span className="mono">
          Same verdict engine as Guardian · ALLOW · REVIEW · DENY
        </span>
      </footer>
    </main>
  );
}
