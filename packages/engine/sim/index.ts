/**
 * sim — the transaction-EFFECT simulation layer. simulateEffects() simulates a
 * proposed approve/transfer against LIVE Base state before signing and returns
 * the real EffectFacts the combiner (decide.ts) already judges, plus the raw
 * outflows/approvals/revert we observed and an honest `notChecked` list.
 *
 * PROVIDER CHAIN, tried in order with capability detection:
 *   1. tenderly   — primary, most complete (needs TENDERLY_* env; 3rd-party/paid).
 *   2. rpc-trace  — debug_traceCall on BASE_RPC_URL, if the node supports it.
 *   3. rpc-call   — DEGRADED eth_call: revert-only, no asset changes.
 *   4. none       — nothing could run → ran:false. We NEVER fabricate a clean sim.
 *
 * FAIL-SAFE: error / timeout / no-provider → provider "none", simulated:false,
 * effects:{}. That pushes the verdict toward caution (the combiner judges only the
 * other real signals); it can never invent an ALLOW.
 */
import { buildSimTx } from "./encode";
import { deriveEffects } from "./parse";
import { RpcCallProvider, RpcTraceProvider } from "./rpc";
import { TenderlyProvider, tenderlyConfigFromEnv } from "./tenderly";
import type { SimAction, SimOutcome, SimProviderImpl } from "./types";

export * from "./types";
export { buildSimTx } from "./encode";
export {
  deriveEffects,
  decodeLogs,
  parseTenderlySimulation,
  parseTraceResult,
} from "./parse";
export { detectTraceSupport, _resetTraceSupport } from "./rpc";

const DEFAULT_TIMEOUT_MS = 4000;

function timeoutMsFromEnv(): number {
  const raw = typeof process !== "undefined" ? process.env?.SIM_TIMEOUT_MS : undefined;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** Resolve a provider run with a hard timeout. Timeout OR throw → null (fall through). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), ms);
    p.then((v) => finish(v)).catch(() => finish(null));
  });
}

export interface SimulateOptions {
  /** Override the per-simulation timeout (ms). Defaults to SIM_TIMEOUT_MS or 4000. */
  timeoutMs?: number;
  /** Inject the provider chain (for tests). Defaults to env-configured chain. */
  providers?: SimProviderImpl[];
}

// notChecked copy — kept here so the honest "what didn't run" message is uniform.
const HIDDEN_NOT_CHECKED =
  "Hidden value movement / over-approval beyond the stated intent was NOT checked.";
const MISMATCH_NOT_CHECKED =
  "Whether the net effect matches the declared intent was NOT checked.";
const HONEYPOT_NOT_CHECKED =
  "Honeypot (sell-path) detection was NOT performed (needs a buy→sell round-trip).";

const DEGRADED_NOT_CHECKED = [
  "Only revert/no-revert was checked via eth_call — this RPC exposes no asset-change data.",
  HIDDEN_NOT_CHECKED,
  MISMATCH_NOT_CHECKED,
  HONEYPOT_NOT_CHECKED,
];
const NONE_NOT_CHECKED = [
  "Transaction-effect simulation did NOT run (no provider available, or it errored/timed out). simulated=false reflects this.",
  HIDDEN_NOT_CHECKED,
  MISMATCH_NOT_CHECKED,
  HONEYPOT_NOT_CHECKED,
];

function noneOutcome(extra: string[] = []): SimOutcome {
  return {
    effects: {},
    simulated: false,
    provider: "none",
    reverted: false,
    outflows: [],
    approvals: [],
    notChecked: [...NONE_NOT_CHECKED, ...extra],
  };
}

/** Build the default env-configured provider chain. */
function defaultProviders(timeoutMs: number): SimProviderImpl[] {
  return [
    new TenderlyProvider(tenderlyConfigFromEnv(timeoutMs)),
    new RpcTraceProvider(),
    new RpcCallProvider(),
  ];
}

/**
 * Simulate `action`'s effects against live Base state. Always resolves an honest
 * SimOutcome — never throws, never fabricates a clean sim.
 */
export async function simulateEffects(
  action: SimAction,
  opts: SimulateOptions = {}
): Promise<SimOutcome> {
  const timeoutMs = opts.timeoutMs ?? timeoutMsFromEnv();
  const providers = opts.providers ?? defaultProviders(timeoutMs);
  const tx = buildSimTx(action);

  for (const provider of providers) {
    let ok = false;
    try {
      ok = await provider.available();
    } catch {
      ok = false;
    }
    if (!ok) continue;

    const result = await withTimeout(provider.run(tx), timeoutMs);
    if (!result) continue; // unavailable / error / timeout → next provider

    if (!result.effectsObserved) {
      // Degraded (eth_call): revert-only, no asset changes parsed.
      return {
        effects: {},
        simulated: false,
        provider: provider.name,
        reverted: result.parsed.reverted,
        revertReason: result.parsed.revertReason,
        outflows: [],
        approvals: [],
        notChecked: DEGRADED_NOT_CHECKED,
      };
    }

    // A real effect simulation ran (tenderly / rpc-trace).
    const derived = deriveEffects(result.parsed, action);
    return {
      effects: derived.effects,
      simulated: true,
      provider: provider.name,
      reverted: result.parsed.reverted,
      revertReason: result.parsed.revertReason,
      outflows: derived.outflows,
      approvals: derived.approvals,
      notChecked: derived.notChecked,
    };
  }

  return noneOutcome();
}
