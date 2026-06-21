/**
 * sim/types — the shared shapes of the transaction-EFFECT simulation layer.
 *
 * This layer answers a single question, honestly: "if this proposed transaction
 * were sent against live Base state RIGHT NOW, what would actually happen?" It
 * then reduces that to the EffectFacts the pure combiner (decide.ts) already
 * knows how to judge — honeypot / hidden-transfer / intent-mismatch — plus the
 * raw outflows/approvals/revert we observed, so callers can report them verbatim.
 *
 * HONESTY CONTRACT (enforced throughout):
 *   - `simulated` is true ONLY when a provider actually executed the tx AND we
 *     parsed real asset changes from it. Never otherwise.
 *   - any error / timeout / missing-provider → provider "none", simulated:false,
 *     effects:{} — which pushes the verdict toward caution, never toward ALLOW.
 *   - a check we could not run is listed in `notChecked`, never silently assumed.
 */
import type { Address } from "viem";
import type { EffectFacts } from "../decide";

/** Which simulation provider produced a result (or that none could run). */
export type SimProvider = "tenderly" | "rpc-trace" | "rpc-call" | "none";

/** Sentinel "token" address for native ETH movement (no ERC-20 contract). */
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000" as Address;

/** A normalized token movement extracted from a simulation. */
export interface RawTransfer {
  /** ERC-20 contract address, or NATIVE_TOKEN for ETH value. */
  token: Address;
  from: Address;
  to: Address;
  /** Raw on-chain units. */
  amount: bigint;
  /** True when this is native ETH value rather than an ERC-20 Transfer event. */
  native?: boolean;
}

/** A normalized approval (ERC-20 Approval event) extracted from a simulation. */
export interface RawApproval {
  token: Address;
  owner: Address;
  spender: Address;
  /** Raw allowance granted; compare to UNLIMITED_THRESHOLD for "unlimited". */
  amount: bigint;
}

/**
 * Provider-agnostic parse of a single simulated call: every transfer/approval it
 * emitted, plus whether the call reverted. This is the intermediate shape every
 * provider reduces to, BEFORE we compare it against the declared intent.
 */
export interface ParsedSim {
  transfers: RawTransfer[];
  approvals: RawApproval[];
  /** True if the simulated call reverted (the tx would fail on-chain). */
  reverted: boolean;
  /** Human-readable revert reason, when the provider supplies one. */
  revertReason?: string;
}

/**
 * The normalized action to simulate. Decoupled from the engine's string-amount
 * `SimIntent` and the SDK's bigint `Intent` so BOTH can build it without a
 * second copy of the encoding. `owner` is the signer the tx is simulated *from*.
 */
export type SimAction =
  | {
      kind: "approve";
      owner: Address;
      token: Address;
      spender: Address;
      /** Raw allowance the approve would set. */
      rawAmount: bigint;
      /** Whether the requested allowance is effectively unlimited. */
      unlimited: boolean;
    }
  | {
      kind: "transfer";
      owner: Address;
      token: Address;
      to: Address;
      /** Raw amount to transfer. */
      rawAmount: bigint;
    };

/** The full outcome of the simulation layer — what gatherEffects()/the SDK consume. */
export interface SimOutcome {
  /** Effect facts for the pure combiner. `{}` when nothing was simulated. */
  effects: EffectFacts;
  /** True ONLY if a provider ran AND we parsed real asset changes. */
  simulated: boolean;
  /** Which provider produced this outcome (or "none"). */
  provider: SimProvider;
  /** Whether the simulated tx reverted (only meaningful when a provider ran). */
  reverted: boolean;
  revertReason?: string;
  /** Net token outflows leaving `owner` (for transparent reporting). */
  outflows: RawTransfer[];
  /** Approvals the tx would create/raise. */
  approvals: RawApproval[];
  /** Effect-level checks that could NOT run under the active provider. Verbatim. */
  notChecked: string[];
}

/** A raw, decoded EVM log (address + topics + data) — the unit both providers reduce to. */
export interface RawLog {
  address: Address;
  topics: readonly `0x${string}`[];
  data: `0x${string}`;
}

/** One simulation provider in the fallback chain. */
export interface SimProviderImpl {
  readonly name: Exclude<SimProvider, "none">;
  /** Cheap availability/capability check; may probe the RPC. */
  available(): Promise<boolean>;
  /** Run the simulation; resolve null if it genuinely could not (caller falls through). */
  run(tx: SimTxRequest): Promise<ProviderResult | null>;
}

/** What a provider returns: the parsed sim plus whether it counts as a real effect sim. */
export interface ProviderResult {
  parsed: ParsedSim;
  /**
   * True if this provider's parse reflects REAL asset changes (tenderly / trace).
   * The degraded eth_call provider sets this false — it only knows revert/no-revert.
   */
  effectsObserved: boolean;
}

/** The low-level transaction to simulate (read-only; never signed or broadcast). */
export interface SimTxRequest {
  from: Address;
  /** Token contract for approve/transfer. */
  to: Address;
  data: `0x${string}`;
  value: bigint;
}
