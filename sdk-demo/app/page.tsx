import { SageMark, Lock, Spark, Arrow, External, Bot } from "@/components/Brand";
import { AgentDemo } from "@/components/AgentDemo";

const SNIPPET = `import { ChainSage } from "chainsage";
const cs = new ChainSage();           // local mode · live Base

// Gate every action before it's signed:
await cs.guard(intent, () => agent.sign(tx));
//   ALLOW  → executes      REVIEW → held for human
//   DENY   → throws ChainSageDenied (never signs)`;

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 sm:px-8">
      {/* nav */}
      <nav className="flex items-center justify-between pt-7">
        <div className="flex items-center gap-3">
          <SageMark size={34} />
          <div className="leading-tight">
            <div className="font-bold tracking-tightish text-text">ChainSage</div>
            <div className="micro text-text-3">Agent SDK</div>
          </div>
        </div>
        <a
          href="https://chainsage.finance"
          className="mono inline-flex items-center gap-1.5 rounded-cs border border-hairline px-3 py-1.5 text-xs text-text-2 transition-colors hover:text-text"
        >
          chainsage.finance <External size={12} />
        </a>
      </nav>

      {/* hero */}
      <header className="pt-14 sm:pt-20">
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon={<Bot size={13} />}>Machines call the verdict</Chip>
          <Chip icon={<Spark size={13} />}>Live Base mainnet</Chip>
          <Chip icon={<Lock size={13} />}>Fails safe — never open</Chip>
        </div>
        <h1 className="mt-6 max-w-3xl text-[2.6rem] font-extrabold leading-[1.05] tracking-display text-text sm:text-6xl">
          A verdict before
          <br />
          the signature.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-2">
          An autonomous agent attempts four actions. Each one calls{" "}
          <code className="mono rounded bg-[var(--bg-2)] px-1.5 py-0.5 text-[0.85em] text-text">
            chainsage.check()
          </code>{" "}
          before it signs — and only proceeds on <span style={{ color: "var(--trust)" }}>ALLOW</span>.
          Verdicts are computed live on Base by the real SDK in local mode.
        </p>
        <p className="mono mt-6 max-w-2xl border-l-2 border-[var(--primary)] pl-4 text-sm leading-relaxed text-text-3">
          Settlement moves money. Authorization grants permission.{" "}
          <span className="text-text-2">ChainSage decides whether it should happen.</span>
        </p>

        <div className="mt-7 overflow-hidden rounded-cs border border-hairline bg-[var(--bg-2)]">
          <div className="border-b border-hairline px-4 py-2">
            <span className="micro text-text-3">the whole integration</span>
          </div>
          <pre className="mono overflow-x-auto px-4 py-3 text-[13px] leading-relaxed text-text-2">
            <code>{SNIPPET}</code>
          </pre>
        </div>
      </header>

      {/* the demo */}
      <section className="mt-16">
        <div className="micro mb-2 text-[var(--primary)]">Live demo</div>
        <h2 className="mb-6 text-2xl font-bold tracking-tightish text-text sm:text-3xl">
          Watch the agent get gated
        </h2>
        <AgentDemo />
      </section>

      {/* honesty */}
      <section className="mt-16">
        <div className="micro mb-2 text-[var(--primary)]">No theater</div>
        <h2 className="mb-4 text-2xl font-bold tracking-tightish text-text">What&apos;s real here</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="cs-glass p-5">
            <div className="micro mb-3" style={{ color: "var(--trust)" }}>
              Real
            </div>
            <ul className="space-y-2 text-sm text-text-2">
              <Li>Verdicts are computed live by the SDK against Base — never hard-coded.</Li>
              <Li>The DENY (send to the token contract) is a permanent, real rule — it can&apos;t age out.</Li>
              <Li>Spender/destination/token classification is real on-chain reads via the shared engine.</Li>
            </ul>
          </div>
          <div className="cs-glass p-5">
            <div className="micro mb-3 text-text-3">Simulated / forward-looking</div>
            <ul className="space-y-2 text-sm text-text-2">
              <Li>Execution is simulated — this demo never signs or broadcasts a transaction.</Li>
              <Li>Swap route / price / output are not simulated; only the token contracts are classified.</Li>
              <Li>
                <span className="text-[var(--cyan)]">x402</span> settlement is not live — treated as a value
                transfer and flagged experimental.
              </Li>
              <Li>Pipeline stages “Policy” and “Trust network” are roadmap (Phase 4/5), not yet in the verdict.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* flow */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center gap-2">
          <FlowToken color="var(--text-3)">agent intent</FlowToken>
          <Arrow size={16} className="text-text-3" />
          <FlowToken color="var(--primary)">chainsage.check()</FlowToken>
          <Arrow size={16} className="text-text-3" />
          <FlowToken color="var(--text-3)">ALLOW → execute</FlowToken>
        </div>
      </section>

      <footer className="mt-20 border-t border-hairline pt-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <SageMark size={28} />
            <span className="text-sm text-text-2">ChainSage — the trust layer for autonomous finance.</span>
          </div>
          <div className="mono text-xs text-text-3">
            $SAGE launching natively on Bankr · Bankr integration in progress
          </div>
        </div>
        <p className="mono mt-4 text-xs leading-relaxed text-text-3">
          Phase 3 of the ChainSage roadmap. The SDK is read-only: it returns a verdict and never holds keys,
          signs, or broadcasts. <code>npm install chainsage</code>
        </p>
      </footer>
    </main>
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
    <span className="mono rounded-cs border px-3 py-1.5 text-xs" style={{ color, borderColor: "var(--hairline)" }}>
      {children}
    </span>
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
