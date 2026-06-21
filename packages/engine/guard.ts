/**
 * guard — signal-GATHERING orchestration for a proposed intent, then a single
 * call to the pure combiner decide(). This is the async, I/O half of the
 * Guardian verdict path; decide() (decide.ts) is the pure half.
 *
 * What is LIVE today (real Base reads, via classify.ts / chain.ts / sim/):
 *   - approve  : spender contract identity, bounded age, known-good allowlist,
 *                unlimited-allowance detection → evaluateApprove calibration.
 *   - transfer : destination identity/age, zero-address, token-self-send → evaluateTransfer.
 *   - effects  : transaction-EFFECT simulation (hidden-transfer / over-approval /
 *                intent-mismatch / revert) via sim/ — when an `owner` (intent.from)
 *                is supplied AND a provider (Tenderly or a trace-capable RPC) is
 *                configured. See gatherEffects() below.
 *
 * HONESTY: `simulated:true` ONLY when a real effect simulation ran and parsed
 * asset changes. No owner / no provider / error / timeout → simulated:false and
 * the unrun checks are listed in `notChecked`. We never fabricate a clean sim.
 * Honeypot (sell-path) detection still cannot be derived from a single
 * approve/transfer intent — it is honestly listed as not-checked.
 */
import { getAddress, parseUnits } from "viem";
import { MAX_UINT256, getTokenMeta } from "./chain";
import { classifyAddress, type Classification } from "./classify";
import { isUnlimitedAmount, type SimIntent } from "./simulate";
import { simulateEffects, type SimAction, type SimProvider } from "./sim";
import {
  approveSignals,
  decide,
  effectSignals,
  transferSignals,
  type EffectFacts,
  type GuardianVerdict,
  type Signal,
} from "./decide";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface GuardResult extends GuardianVerdict {
  /** Unique, stable id for this decision — for audit logs. */
  verdictId: string;
  /** Which effect-simulation provider ran (or "none"). */
  simProvider: SimProvider;
  /** True if the simulated transaction reverts (only meaningful when a provider ran). */
  reverted: boolean;
  /** Spender classification (approve only). */
  spenderClassification?: Classification;
  /** Destination classification (transfer only). */
  destinationClassification?: Classification;
}

/** Resolve an intent's human amount to raw units (unlimited → MAX_UINT256).
 * Throws with an "amount …" message on a bad value so the API maps it to 400. */
function resolveRawAmount(amount: string, decimals: number): { raw: bigint; unlimited: boolean } {
  const a = amount.trim().toLowerCase();
  if (a === "unlimited" || a === "max" || a === "infinite") {
    return { raw: MAX_UINT256, unlimited: true };
  }
  let raw: bigint;
  try {
    raw = parseUnits(a, decimals);
  } catch {
    throw new Error(`amount "${amount}" is not a valid number or "unlimited"/"max".`);
  }
  return { raw, unlimited: raw >= MAX_UINT256 / 2n };
}

/**
 * Gather transaction-effect facts by simulating the proposed intent against live
 * Base state (sim/). Requires intent.from (the signer). Without it — or when no
 * provider can run — returns simulated:false with an honest notChecked, which
 * leaves the verdict to the other real signals (never an invented ALLOW).
 */
async function gatherEffects(intent: SimIntent): Promise<{
  effects: EffectFacts;
  simulated: boolean;
  provider: SimProvider;
  reverted: boolean;
  revertReason?: string;
  notChecked: string[];
}> {
  if (!intent.from) {
    return {
      effects: {},
      simulated: false,
      provider: "none",
      reverted: false,
      notChecked: [
        "Transaction-effect simulation did NOT run: the intent carries no `from` (owner) address, so the tx cannot be simulated. Provide `from` to enable honeypot/hidden-transfer/intent-mismatch checks.",
      ],
    };
  }

  const token = getAddress(intent.token);
  const owner = getAddress(intent.from);
  const meta = await getTokenMeta(token);
  const { raw, unlimited } = resolveRawAmount(intent.amount, meta.decimals);

  const action: SimAction =
    intent.type === "approve"
      ? { kind: "approve", owner, token, spender: getAddress(intent.spender), rawAmount: raw, unlimited }
      : { kind: "transfer", owner, token, to: getAddress(intent.to), rawAmount: raw };

  const outcome = await simulateEffects(action);
  return {
    effects: outcome.effects,
    simulated: outcome.simulated,
    provider: outcome.provider,
    reverted: outcome.reverted,
    revertReason: outcome.revertReason,
    notChecked: outcome.notChecked,
  };
}

/** A reverting tx is surfaced as a REVIEW signal (it won't execute as intended).
 * This FEEDS decide() a real fact; it does not change the combiner's logic. */
function revertSignal(revertReason?: string): Signal {
  return {
    id: "sim-revert",
    severity: "REVIEW",
    title: "Transaction reverts in simulation",
    detail: `Simulating this transaction against live state shows it reverts${
      revertReason ? ` (${revertReason})` : ""
    } — it will not execute as intended. Verify balances/allowances and the target before signing.`,
  };
}

function makeVerdictId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `vrd_${uuid}`;
  return `vrd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Gather every signal we can for `intent`, then combine with decide(). Errors in
 * gathering propagate to the caller, which fails SAFE (the API maps to a 500 /
 * the SDK to a non-ALLOW fail-safe verdict). decide() itself never throws.
 */
export async function guardIntent(intent: SimIntent): Promise<GuardResult> {
  // Effect simulation — gathered first so its notChecked is honest.
  const { effects, simulated, notChecked, provider, reverted, revertReason } =
    await gatherEffects(intent);
  // Effect-level signals (hidden-transfer / intent-mismatch) plus a revert signal
  // when the sim shows the tx would fail. Both FEED decide() real facts.
  const effectSigs = [...effectSignals(effects), ...(reverted ? [revertSignal(revertReason)] : [])];

  if (intent.type === "approve") {
    const token = getAddress(intent.token);
    const spenderAddr = getAddress(intent.spender);
    const meta = await getTokenMeta(token);
    const isUnlimited = isUnlimitedAmount(intent.amount, meta.decimals);
    const spender = await classifyAddress(spenderAddr);

    const signals: Signal[] = [...effectSigs, ...approveSignals(spender, isUnlimited)];
    const result = decide({ signals, simulated, notChecked });
    return {
      ...result,
      // Surface the on-chain classification detail alongside the decisive reasons.
      reasons: [...result.reasons, ...spender.signals],
      verdictId: makeVerdictId(),
      simProvider: provider,
      reverted,
      spenderClassification: spender,
    };
  }

  // transfer
  const token = getAddress(intent.token);
  const to = getAddress(intent.to);
  const toIsZero = to.toLowerCase() === ZERO_ADDRESS;
  const toIsTokenContract = to.toLowerCase() === token.toLowerCase();
  const destination = await classifyAddress(to);

  const signals: Signal[] = [
    ...effectSigs,
    ...transferSignals({ toIsZero, toIsTokenContract, destination }),
  ];
  const result = decide({ signals, simulated, notChecked });
  return {
    ...result,
    reasons: [...result.reasons, ...destination.signals],
    verdictId: makeVerdictId(),
    simProvider: provider,
    reverted,
    destinationClassification: destination,
  };
}
