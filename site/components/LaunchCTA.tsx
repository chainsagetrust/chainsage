import { Reveal } from "./motion";
import { Button } from "./ui";
import { SageMark } from "./SageMark";

/**
 * Final CTA — the emotional close. Replaces the old email waitlist with a direct
 * entry into the live product: "Launch App" → /app (Guardian). No email capture.
 */
export function LaunchCTA() {
  return (
    <section id="launch" className="mx-auto max-w-4xl px-5 py-28 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--card-border)] bg-[var(--card)] px-6 py-16 text-center backdrop-blur-xl sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, rgba(124,92,255,0.22), transparent 70%)",
            }}
          />
          <div className="mb-6 flex justify-center">
            <SageMark size={52} />
          </div>
          <h2 className="mx-auto max-w-2xl font-display text-[2rem] font-extrabold leading-[1.06] tracking-[-0.03em] text-text sm:text-[2.75rem]">
            Help Build the Trust Layer for{" "}
            <span className="cs-gradient-text">Autonomous Finance.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[1.02rem] leading-relaxed text-text-2">
            Guardian is live on Base today — scan any wallet, read-only, and get a
            verdict on its approval surface. The rest of the trust layer is being
            built in the open.
          </p>

          <div className="mx-auto mt-9 flex flex-wrap justify-center gap-3">
            <Button href="/app" className="px-6 py-3 text-[1rem]">
              Launch App
            </Button>
            <Button href="#how" variant="ghost" className="px-6 py-3 text-[1rem]">
              How it works
            </Button>
          </div>

          <p className="mt-5 font-mono text-[0.72rem] text-text-3">
            Read-only · keys never touched · no funds ever moved
          </p>
        </div>
      </Reveal>
    </section>
  );
}
