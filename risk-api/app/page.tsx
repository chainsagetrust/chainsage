import { SageMark, Gauge, Scan, Spark, Lock, Arrow, External, CheckC, Hand, Ban } from "@/components/Brand";
import { CodeBlock } from "@/components/CodeBlock";
import { TryIt } from "@/components/TryIt";
import { VerdictPill } from "@/components/Verdict";

/* ------------------------------------------------------------------ examples */

const SCORE_RES = `{
  "ok": true,
  "data": {
    "report": {
      "healthScore": 29,
      "verdict": "DENY",
      "flags": [
        {
          "id": "drainer-0xtoken-0xspender",
          "severity": "danger",
          "title": "Unlimited approval to a brand-new contract",
          "detail": "USDC: this spender combines an unlimited allowance with a contract under 7 days old — the textbook wallet-drainer pattern. Revoke this first.",
          "spender": "0x…",
          "basescanLink": "https://basescan.org/address/0x…"
        }
      ],
      "stats": {
        "totalApprovals": 3,
        "unlimitedApprovals": 2,
        "freshApprovals": 1,
        "drainerApprovals": 1,
        "tokensHeld": 2
      }
    },
    "meta": { "scannedAt": "2026-06-17T12:00:00.000Z", "blockNumber": "21345678", "chain": "base" }
  }
}`;

const CLASSIFY_RES = `{
  "ok": true,
  "data": {
    "verdict": "REVIEW",
    "isContract": true,
    "ageDays": 2,
    "isFresh": true,
    "knownGood": null,
    "signals": [
      "Address has deployed bytecode (it is a contract).",
      "Freshly deployed contract — under 7 days old (bounded estimate: ~2d). Newly deployed spenders are the single strongest wallet-drainer signal."
    ]
  }
}`;

const SIMULATE_RES = `{
  "ok": true,
  "data": {
    "verdict": "DENY",
    "reasons": [
      "Unlimited allowance to a freshly deployed contract (<7d) — the textbook wallet-drainer pattern. Do not sign.",
      "Address has deployed bytecode (it is a contract).",
      "Freshly deployed contract — under 7 days old (bounded estimate: ~1d)."
    ],
    "wouldExposeUnlimited": true,
    "spenderClassification": {
      "verdict": "REVIEW", "isContract": true, "ageDays": 1, "isFresh": true, "knownGood": null, "signals": ["…"]
    },
    "notChecked": [
      "Token-contract honesty (fee-on-transfer, blocklists, upgradeable logic) is not simulated.",
      "Your current balance and any existing allowance are not read — the intent carries no owner address."
    ]
  }
}`;

const CURL = `curl -s https://your-host/api/v1/score \\
  -H "content-type: application/json" \\
  -H "x-api-key: demo" \\
  -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'`;

const FETCH = `const res = await fetch("https://your-host/api/v1/score", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": "demo" },
  body: JSON.stringify({ address: "0x…" }),
});
const { ok, data, error } = await res.json();
if (ok) console.log(data.report.verdict); // "ALLOW" | "REVIEW" | "DENY"`;

const SIM_REQ = `{
  "type": "approve",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "spender": "0x…",
  "amount": "unlimited"
}`;

/* ------------------------------------------------------------------ page */

export default function Console() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
      <Nav />

      {/* hero */}
      <header className="pt-14 sm:pt-20">
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon={<Spark size={13} />}>Live Base mainnet</Chip>
          <Chip icon={<Lock size={13} />}>Read-only · keys never touched</Chip>
          <Chip icon={<Gauge size={13} />}>Verdict in one call</Chip>
        </div>
        <h1 className="mt-6 max-w-3xl text-[2.6rem] font-extrabold leading-[1.05] tracking-display text-text sm:text-6xl">
          The trust layer,
          <br />
          as an API.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-2">
          The same intelligence behind Guardian, exposed as embeddable infrastructure. Score a wallet,
          classify a spender, or simulate a transaction before it&apos;s signed — every verdict grounded
          in live on-chain reads.
        </p>
        <p className="mono mt-6 max-w-2xl border-l-2 border-[var(--primary)] pl-4 text-sm leading-relaxed text-text-3">
          Settlement moves money. Authorization grants permission.{" "}
          <span className="text-text-2">ChainSage decides whether it should happen.</span>
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <FlowToken color="var(--text-3)">intent</FlowToken>
          <Arrow size={16} className="text-text-3" />
          <FlowToken color="var(--primary)">ChainSage verdict</FlowToken>
          <Arrow size={16} className="text-text-3" />
          <FlowToken color="var(--text-3)">execution</FlowToken>
        </div>
      </header>

      {/* live try-it */}
      <Section id="try" eyebrow="Try it live" title="Score an address right now">
        <p className="mb-5 max-w-2xl text-text-2">
          A real call to <Mono>POST /api/v1/score</Mono> against live Base mainnet, using the public{" "}
          <Mono>demo</Mono> key. Same response any integrator receives.
        </p>
        <TryIt />
      </Section>

      {/* verdict legend */}
      <Section id="verdicts" eyebrow="The contract" title="Three verdicts, one meaning everywhere">
        <div className="grid gap-4 sm:grid-cols-3">
          <VerdictCard verdict="ALLOW" icon={<CheckC size={20} />}>
            No concrete on-chain risk signal. Safe to proceed.
          </VerdictCard>
          <VerdictCard verdict="REVIEW" icon={<Hand size={20} />}>
            A signal worth a human look — fresh spender, unlimited surface, an EOA target.
          </VerdictCard>
          <VerdictCard verdict="DENY" icon={<Ban size={20} />}>
            A verifiable drainer pattern — e.g. unlimited approval to a freshly deployed contract.
          </VerdictCard>
        </div>
      </Section>

      {/* endpoints */}
      <Section id="endpoints" eyebrow="Reference" title="Endpoints">
        <p className="mb-7 max-w-2xl text-text-2">
          All endpoints are <Mono>POST</Mono>, versioned under <Mono>/api/v1</Mono>, and return{" "}
          <Mono>{`{ ok, data }`}</Mono> or <Mono>{`{ ok, error }`}</Mono> with a correct status code.
          Send your key as the <Mono>x-api-key</Mono> header.
        </p>

        <Endpoint
          method="POST"
          path="/api/v1/score"
          summary="Score a wallet's health and surface actionable flags."
          reqLabel='{ "address": "0x…" }'
          req={`{ "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }`}
          res={SCORE_RES}
          notes={[
            "Runs Guardian's exact scan path: live balances → live approvals (allowance re-read on-chain) → bounded contract ages → buildReport().",
            "Returns the full WalletReport (healthScore 0–100, verdict, flags[], stats) plus meta { scannedAt, blockNumber, chain }.",
          ]}
        />

        <Endpoint
          method="POST"
          path="/api/v1/classify"
          summary="Classify a spender/contract — is it risky?"
          reqLabel='{ "address": "0x…" }'
          req={`{ "address": "0x…" }`}
          res={CLASSIFY_RES}
          notes={[
            "Grounded in on-chain reads only: getCode (EOA vs contract), bounded contract-age sampling, and a curated known-good allowlist (Permit2, Uniswap routers on Base).",
            "Fresh contract (<7d) → REVIEW; EOA → REVIEW; known-good or established → ALLOW. Every signal maps to a real read.",
          ]}
        />

        <Endpoint
          method="POST"
          path="/api/v1/simulate"
          summary="Simulate a proposed intent before it's signed."
          reqLabel='{ "type": "approve" | "transfer", … }'
          req={SIM_REQ}
          res={SIMULATE_RES}
          notes={[
            "approve { token, spender, amount }: the verdict leans on classifying the spender. Fresh + unlimited → DENY (matches Guardian's drainer calibration).",
            "transfer { token, to, amount }: destination checks only (zero address, token-self, fresh contract). amount is a token amount or the literal \"unlimited\"/\"max\".",
            "Honesty: the response carries an explicit notChecked[] — no field is returned for a check that wasn't run.",
          ]}
        />
      </Section>

      {/* snippets */}
      <Section id="quickstart" eyebrow="Quickstart" title="Call it in two lines">
        <div className="grid gap-4 lg:grid-cols-2">
          <CodeBlock label="cURL" language="bash" code={CURL} />
          <CodeBlock label="fetch (JS/TS)" language="javascript" code={FETCH} />
        </div>
      </Section>

      {/* auth + limits */}
      <Section id="auth" eyebrow="Access" title="Auth, rate limits & CORS">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard icon={<Lock size={18} />} title="API keys">
            Send a key as the <Mono>x-api-key</Mono> header (or <Mono>Authorization: Bearer</Mono>, or{" "}
            <Mono>?key=</Mono>). The public <Mono>demo</Mono> key is always accepted and heavily
            rate-limited so this page works out of the box. Real keys come from the{" "}
            <Mono>RISK_API_KEYS</Mono> env allowlist.{" "}
            <span className="text-text-3">Auth is a stub — see below.</span>
          </InfoCard>
          <InfoCard icon={<Gauge size={18} />} title="Rate limits">
            In-memory token bucket — burst of 20, refilling 1 every 2s, per key (the demo key is
            bucketed per-IP). On <Mono>429</Mono> you get a <Mono>Retry-After</Mono> header. Swap in
            Redis/Upstash before scaling horizontally.
          </InfoCard>
          <InfoCard icon={<Scan size={18} />} title="CORS">
            Open by default (<Mono>*</Mono>), configurable via <Mono>RISK_API_CORS_ORIGINS</Mono>.
            Preflight <Mono>OPTIONS</Mono> is answered for every endpoint.
          </InfoCard>
          <InfoCard icon={<Spark size={18} />} title="Errors">
            Malformed input is a <Mono>400</Mono> with a precise message — never a <Mono>500</Mono>.
            A <Mono>500</Mono> means a genuine chain/server fault, and never leaks internals.
          </InfoCard>
        </div>
      </Section>

      {/* honesty */}
      <Section id="honesty" eyebrow="No fabricated checks" title="What's grounded · what's a stub">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="cs-glass p-5">
            <div className="micro mb-3" style={{ color: "var(--trust)" }}>
              Grounded — real on-chain reads
            </div>
            <ul className="space-y-2 text-sm text-text-2">
              <Li>Live ERC-20 approval logs, with each allowance re-read on-chain (never stale).</Li>
              <Li>Contract vs EOA via getCode; bounded contract-age via bytecode sampling.</Li>
              <Li>The verdict engine is the same tested @chainsage/engine that powers Guardian.</Li>
            </ul>
          </div>
          <div className="cs-glass p-5">
            <div className="micro mb-3 text-text-3">Scaffolded — clearly a stub</div>
            <ul className="space-y-2 text-sm text-text-2">
              <Li>API keys: env allowlist, no billing, no persistence, no per-key scopes yet.</Li>
              <Li>Rate limiting: in-memory, per-instance — resets on redeploy.</Li>
              <Li>Contract age is a bounded estimate (public-RPC friendly), not an exact deploy block.</Li>
            </ul>
          </div>
        </div>
      </Section>

      <Footer />
    </main>
  );
}

/* ------------------------------------------------------------------ pieces */

function Nav() {
  return (
    <nav className="flex items-center justify-between pt-7">
      <div className="flex items-center gap-3">
        <SageMark size={34} />
        <div className="leading-tight">
          <div className="font-bold tracking-tightish text-text">ChainSage</div>
          <div className="micro text-text-3">Risk API</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a href="#endpoints" className="hidden text-sm text-text-2 hover:text-text sm:block">
          Endpoints
        </a>
        <a href="#try" className="hidden text-sm text-text-2 hover:text-text sm:block">
          Try it
        </a>
        <a
          href="https://chainsage.finance"
          className="mono inline-flex items-center gap-1.5 rounded-cs border border-hairline px-3 py-1.5 text-xs text-text-2 transition-colors hover:text-text"
        >
          chainsage.finance <External size={12} />
        </a>
      </div>
    </nav>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-20 scroll-mt-8">
      <div className="micro mb-2 text-[var(--primary)]">{eyebrow}</div>
      <h2 className="mb-6 text-2xl font-bold tracking-tightish text-text sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="mono inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1 text-xs text-text-2">
      {icon}
      {children}
    </span>
  );
}

function FlowToken({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="mono rounded-cs border px-3 py-1.5 text-xs"
      style={{ color, borderColor: "var(--hairline)" }}
    >
      {children}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="mono rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[0.85em] text-text">
      {children}
    </code>
  );
}

function Endpoint({
  method,
  path,
  summary,
  reqLabel,
  req,
  res,
  notes,
}: {
  method: string;
  path: string;
  summary: string;
  reqLabel: string;
  req: string;
  res: string;
  notes: string[];
}) {
  return (
    <div className="cs-glass mb-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="mono rounded-md px-2 py-1 text-xs font-bold"
          style={{ color: "var(--primary)", background: "rgba(124,92,255,0.14)" }}
        >
          {method}
        </span>
        <span className="mono text-sm text-text sm:text-base">{path}</span>
      </div>
      <p className="mt-3 text-text-2">{summary}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <CodeBlock label={`request — ${reqLabel}`} language="json" code={req} />
        <CodeBlock label="response" language="json" code={res} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {notes.map((n, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-text-2">
            <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VerdictCard({
  verdict,
  icon,
  children,
}: {
  verdict: "ALLOW" | "REVIEW" | "DENY";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="cs-glass p-5">
      <div className="flex items-center justify-between">
        <VerdictPill verdict={verdict} />
        <span className="text-text-3">{icon}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text-2">{children}</p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cs-glass p-5">
      <div className="flex items-center gap-2 text-text">
        <span className="text-[var(--primary)]">{icon}</span>
        <span className="font-semibold">{title}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-2">{children}</p>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 leading-relaxed">
      <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-text-3" />
      {children}
    </li>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-hairline pt-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <SageMark size={28} />
          <span className="text-sm text-text-2">
            ChainSage — the trust layer for autonomous finance.
          </span>
        </div>
        <div className="mono text-xs text-text-3">
          $SAGE launching natively on Bankr · Bankr integration in progress
        </div>
      </div>
      <p className="mono mt-4 text-xs leading-relaxed text-text-3">
        Read-only by default. The Risk API never holds keys, never signs, and never builds
        transactions — it returns a verdict. Phase 2 of the ChainSage roadmap.
      </p>
    </footer>
  );
}
