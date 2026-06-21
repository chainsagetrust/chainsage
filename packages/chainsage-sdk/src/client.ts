/**
 * ChainSage — ask for a verdict before your agent signs.
 *
 *   const cs = new ChainSage();             // local mode by default
 *   const verdict = await cs.check(intent); // ALLOW | REVIEW | DENY
 *   await cs.guard(intent, () => sign(tx));  // runs only on ALLOW
 *
 * FAIL-SAFE GUARANTEE: check() never returns ALLOW when it could not actually
 * compute a verdict. Any network error, timeout, or read failure yields a
 * non-ALLOW fail-safe verdict (REVIEW by default, DENY if configured). A trust
 * layer that fails open is worse than none.
 */
import {
  MAX_UINT256,
  UNLIMITED_THRESHOLD,
  simulateEffects,
  type SimAction,
  type SimOutcome,
  type SimProviderImpl,
} from "@chainsage/engine";
import type {
  Address,
  ChainSageConfig,
  Decision,
  GuardOptions,
  Intent,
  Verdict,
} from "./types";
import { ChainSageDenied, ChainSageError, ChainSageReview } from "./errors";
import { ApiFacts, LocalFacts, type Facts } from "./facts";
import {
  approveParts,
  buildFailSafe,
  buildVerdict,
  swapParts,
  transferParts,
  x402Parts,
  type EvalParts,
} from "./map";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function amountIsUnlimited(amount: bigint | "unlimited"): boolean {
  return amount === "unlimited" || amount >= UNLIMITED_THRESHOLD;
}

function isZeroAddress(a: Address): boolean {
  return a.toLowerCase() === ZERO_ADDRESS;
}

function sameAddress(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export class ChainSage {
  readonly mode: "api" | "local";
  private readonly onError: Extract<Decision, "REVIEW" | "DENY">;
  private readonly facts: Facts;
  /** Live effect simulation is opt-in and LOCAL-mode only. */
  private readonly simEnabled: boolean;
  private readonly simProviders?: SimProviderImpl[];

  constructor(cfg: ChainSageConfig = {}) {
    this.mode = cfg.mode ?? "local";
    this.onError = cfg.onError ?? "REVIEW";
    this.simEnabled = !!cfg.simulate && this.mode === "local";
    this.simProviders = cfg.simProviders as SimProviderImpl[] | undefined;
    this.facts =
      this.mode === "api"
        ? new ApiFacts({
            ...cfg,
            apiUrl: cfg.apiUrl ?? env("CHAINSAGE_API_URL") ?? "http://localhost:3001",
            apiKey: cfg.apiKey ?? env("CHAINSAGE_API_KEY") ?? "demo",
          })
        : new LocalFacts();
  }

  /**
   * Return a verdict for `intent`. Malformed intents throw ChainSageError
   * (a developer error). Everything else — including failures — resolves to a
   * Verdict; failures resolve to a fail-safe non-ALLOW verdict.
   */
  async check(intent: Intent): Promise<Verdict> {
    this.validate(intent);
    try {
      const parts = await this.evaluate(intent);
      return buildVerdict(intent, parts, this.mode);
    } catch (err) {
      return buildFailSafe(intent, this.mode, this.onError, err);
    }
  }

  /**
   * Check the intent, then run `execute` ONLY if the verdict is ALLOW.
   *  - DENY  → throws ChainSageDenied (execute never runs).
   *  - REVIEW → per `onReview` (default "deny" → throws ChainSageReview).
   *  - ALLOW → runs and returns `execute()`'s result.
   */
  async guard<T>(
    intent: Intent,
    execute: () => T | Promise<T>,
    opts: GuardOptions = {}
  ): Promise<T> {
    const verdict = await this.check(intent);
    if (verdict.decision === "DENY") throw new ChainSageDenied(verdict);
    if (verdict.decision === "REVIEW") {
      const policy = opts.onReview ?? "deny";
      let proceed: boolean;
      if (policy === "allow") proceed = true;
      else if (policy === "deny") proceed = false;
      else proceed = await policy(verdict);
      if (!proceed) throw new ChainSageReview(verdict);
    }
    return execute();
  }

  // --- internals ----------------------------------------------------------

  private async evaluate(intent: Intent): Promise<EvalParts> {
    switch (intent.kind) {
      case "approve": {
        const [spender, effects] = await Promise.all([
          this.facts.classify(intent.spender),
          this.gatherEffects(intent),
        ]);
        return approveParts(spender, amountIsUnlimited(intent.amount), effects);
      }
      case "transfer": {
        const [dest, effects] = await Promise.all([
          this.facts.classify(intent.to),
          this.gatherEffects(intent),
        ]);
        return transferParts(
          dest,
          isZeroAddress(intent.to),
          sameAddress(intent.to, intent.token),
          effects
        );
      }
      case "swap": {
        const [tokenIn, tokenOut] = await Promise.all([
          this.facts.classify(intent.tokenIn),
          this.facts.classify(intent.tokenOut),
        ]);
        return swapParts(tokenIn, tokenOut);
      }
      case "x402_pay": {
        const dest = await this.facts.classify(intent.to);
        return x402Parts(dest, isZeroAddress(intent.to));
      }
    }
  }

  /**
   * Simulate the proposed approve/transfer's effects (opt-in, local mode only).
   * Returns undefined when disabled (classify-only path). NEVER throws and never
   * fabricates: a missing provider / error resolves to a not-simulated outcome,
   * which the combiner judges as caution, never ALLOW.
   */
  private async gatherEffects(intent: Intent): Promise<SimOutcome | undefined> {
    if (!this.simEnabled) return undefined;
    if (intent.kind !== "approve" && intent.kind !== "transfer") return undefined;

    const action: SimAction =
      intent.kind === "approve"
        ? {
            kind: "approve",
            owner: intent.owner,
            token: intent.token,
            spender: intent.spender,
            rawAmount: intent.amount === "unlimited" ? MAX_UINT256 : intent.amount,
            unlimited: amountIsUnlimited(intent.amount),
          }
        : {
            kind: "transfer",
            owner: intent.owner,
            token: intent.token,
            to: intent.to,
            rawAmount: intent.amount,
          };

    return simulateEffects(action, this.simProviders ? { providers: this.simProviders } : {});
  }

  private validate(intent: Intent): void {
    if (!intent || typeof intent !== "object") {
      throw new ChainSageError("Intent must be an object.");
    }
    if (intent.chain !== "base") {
      throw new ChainSageError(
        `Unsupported chain "${(intent as { chain?: string }).chain}". Only "base" is live.`
      );
    }
    const addrs: Address[] = [];
    switch (intent.kind) {
      case "approve":
        addrs.push(intent.token, intent.spender, intent.owner);
        if (intent.amount !== "unlimited" && typeof intent.amount !== "bigint") {
          throw new ChainSageError("approve.amount must be a bigint or \"unlimited\".");
        }
        break;
      case "transfer":
        addrs.push(intent.token, intent.to, intent.owner);
        if (typeof intent.amount !== "bigint") {
          throw new ChainSageError("transfer.amount must be a bigint.");
        }
        break;
      case "swap":
        addrs.push(intent.tokenIn, intent.tokenOut, intent.owner);
        if (typeof intent.amountIn !== "bigint") {
          throw new ChainSageError("swap.amountIn must be a bigint.");
        }
        break;
      case "x402_pay":
        addrs.push(intent.to, intent.owner);
        if (typeof intent.amount !== "bigint") {
          throw new ChainSageError("x402_pay.amount must be a bigint.");
        }
        break;
      default:
        throw new ChainSageError(
          `Unknown intent kind "${(intent as { kind?: string }).kind}".`
        );
    }
    for (const a of addrs) {
      if (typeof a !== "string" || !ADDRESS_RE.test(a)) {
        throw new ChainSageError(`Invalid address in intent: ${String(a)}`);
      }
    }
  }
}
