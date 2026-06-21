/**
 * guard — signal-GATHERING orchestration for a proposed intent, then a single
 * call to the pure combiner decide(). This is the async, I/O half of the
 * Guardian verdict path; decide() (decide.ts) is the pure half.
 *
 * What is LIVE today (real Base reads, via classify.ts / chain.ts):
 *   - approve  : spender contract identity, bounded age, known-good allowlist,
 *                unlimited-allowance detection → evaluateApprove calibration.
 *   - transfer : destination identity/age, zero-address, token-self-send → evaluateTransfer.
 *
 * What is STUBBED (honestly reported, never fabricated):
 *   - transaction-EFFECT simulation (honeypot / hidden-transfer / intent-mismatch)
 *     requires debug_traceCall or a fork and is NOT yet wired. We therefore set
 *     `simulated: false` and list those checks in `notChecked`. The decide()
 *     COMBINER already handles these effect signals the moment a real simulator
 *     supplies them — see effectSignals() — so this is a gathering gap, not a
 *     verdict-logic gap.
 *
 * The returned verdict is "capped" honestly: it reflects only the signals we
 * actually computed. We never claim a clean simulation we did not run.
 */
import { getAddress, type Address } from "viem";
import { getTokenMeta } from "./chain";
import { classifyAddress, type Classification } from "./classify";
import { isUnlimitedAmount, type SimIntent } from "./simulate";
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

/** What the effect-simulation layer was asked to verify but cannot yet run. */
const EFFECT_NOT_CHECKED = [
  "Transaction-effect simulation (honeypot / hidden-transfer / intent-mismatch) is NOT yet wired — it needs debug_traceCall or a fork. simulated=false reflects this; these effect signals were not evaluated.",
];

export interface GuardResult extends GuardianVerdict {
  /** Unique, stable id for this decision — for audit logs. */
  verdictId: string;
  /** Spender classification (approve only). */
  spenderClassification?: Classification;
  /** Destination classification (transfer only). */
  destinationClassification?: Classification;
}

/**
 * STUBBED effect gatherer. A real implementation would debug_traceCall / fork
 * and populate EffectFacts. Until then it runs nothing and says so. It NEVER
 * returns fabricated "clean" effect facts.
 */
async function gatherEffects(_intent: SimIntent): Promise<{
  effects: EffectFacts;
  simulated: boolean;
  notChecked: string[];
}> {
  return { effects: {}, simulated: false, notChecked: EFFECT_NOT_CHECKED };
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
  // Effect simulation (stubbed today) — gathered first so its notChecked is honest.
  const { effects, simulated, notChecked } = await gatherEffects(intent);
  const effectSigs = effectSignals(effects);

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
    destinationClassification: destination,
  };
}
