/**
 * simulate — given a proposed intent, return a verdict BEFORE it is signed.
 *
 * Supported low-level intents (the realistic, on-chain-checkable subset):
 *   - approve  { token, spender, amount }
 *   - transfer { token, to, amount }
 *
 * HONESTY CONTRACT: every reason maps to a real read. We do NOT claim checks we
 * don't run — the response carries an explicit `notChecked` list. We have no
 * `from`/owner in the intent, so we never pretend to check balances or existing
 * allowances. The pure evaluate*() functions are unit-tested; the async
 * simulateIntent() does the reads and delegates to them. Shared by the Risk API
 * and the Agent SDK — there is no second copy.
 */
import { getAddress, parseUnits, type Address } from "viem";
import { UNLIMITED_THRESHOLD, getTokenMeta } from "./chain";
import type { Verdict } from "./verdict";
import { classifyAddress, type Classification } from "./classify";

export interface ApproveIntent {
  type: "approve";
  token: Address;
  spender: Address;
  amount: string;
  /**
   * The owner/signer the transaction is sent FROM. OPTIONAL: the classify-based
   * checks don't need it, but the transaction-effect simulation layer (guard.ts)
   * can only run when it is present. Without it, effects are reported not-simulated.
   */
  from?: Address;
}
export interface TransferIntent {
  type: "transfer";
  token: Address;
  to: Address;
  amount: string;
  /** The owner/signer the transfer is sent FROM. Optional — see ApproveIntent.from. */
  from?: Address;
}
export type SimIntent = ApproveIntent | TransferIntent;

export interface SimulationResult {
  verdict: Verdict;
  reasons: string[];
  /** Present for approve only — whether the requested allowance is effectively unlimited. */
  wouldExposeUnlimited?: boolean;
  /** The classification of the approve spender (approve only). */
  spenderClassification?: Classification;
  /** The classification of the transfer destination (transfer only). */
  destinationClassification?: Classification;
  /** Explicit list of things this simulation did NOT check. No fabricated checks. */
  notChecked: string[];
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Decide whether an `amount` string represents an effectively-unlimited
 * allowance. Accepts the literals "unlimited"/"max"/"infinite", or a numeric
 * token amount which we scale by `decimals` and compare to the unlimited
 * threshold. Throws on a non-numeric amount (caller maps to 400).
 */
export function isUnlimitedAmount(amount: string, decimals: number): boolean {
  const a = amount.trim().toLowerCase();
  if (a === "unlimited" || a === "max" || a === "infinite") return true;
  let raw: bigint;
  try {
    raw = parseUnits(a, decimals);
  } catch {
    throw new Error(`amount "${amount}" is not a valid number or "unlimited"/"max".`);
  }
  return raw >= UNLIMITED_THRESHOLD;
}

// --- pure verdict logic ---------------------------------------------------

/**
 * approve calibration (spender classification × allowance size):
 *   EOA spender                       → REVIEW
 *   known-good spender                → ALLOW
 *   fresh contract + unlimited        → DENY   (textbook drainer)
 *   fresh contract + limited          → REVIEW
 *   established contract + unlimited  → REVIEW (standing risk worth a look)
 *   established contract + limited    → ALLOW
 */
export function evaluateApprove(
  spender: Classification,
  isUnlimited: boolean
): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];

  if (!spender.isContract) {
    reasons.push("Spender is an EOA, not a contract — atypical for a protocol approval.");
    return { verdict: "REVIEW", reasons };
  }
  if (spender.knownGood) {
    reasons.push(`Spender is a known-good contract (${spender.knownGood}).`);
    if (isUnlimited)
      reasons.push("Unlimited allowance requested, but the spender is on the known-good allowlist.");
    return { verdict: "ALLOW", reasons };
  }
  if (spender.isFresh && isUnlimited) {
    reasons.push(
      "Unlimited allowance to a freshly deployed contract (<7d) — the textbook wallet-drainer pattern. Do not sign."
    );
    return { verdict: "DENY", reasons };
  }
  if (spender.isFresh) {
    reasons.push(
      "Spender contract is freshly deployed (<7d). The allowance is limited, but verify the spender before approving."
    );
    return { verdict: "REVIEW", reasons };
  }
  if (isUnlimited) {
    reasons.push(
      "Unlimited allowance to an established but un-vetted contract. Consider approving only the amount you need."
    );
    return { verdict: "REVIEW", reasons };
  }
  reasons.push("Limited allowance to an established contract. No fresh-deploy drainer signal.");
  return { verdict: "ALLOW", reasons };
}

export interface TransferFacts {
  toIsZero: boolean;
  toIsTokenContract: boolean;
  destination: Classification;
}

/**
 * transfer calibration (destination properties only — we have no `from`):
 *   to == zero address          → DENY   (burns tokens)
 *   to == token contract        → DENY   (typically unrecoverable)
 *   fresh contract destination  → REVIEW
 *   anything else               → ALLOW  (no on-chain risk signal found)
 */
export function evaluateTransfer(facts: TransferFacts): {
  verdict: Verdict;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (facts.toIsZero) {
    reasons.push("Destination is the zero address — this burns the tokens. Almost always a mistake.");
    return { verdict: "DENY", reasons };
  }
  if (facts.toIsTokenContract) {
    reasons.push(
      "Destination is the token's own contract address. ERC-20s sent here are typically unrecoverable."
    );
    return { verdict: "DENY", reasons };
  }
  if (facts.destination.isContract && facts.destination.isFresh) {
    reasons.push(
      "Destination is a freshly deployed contract (<7d). Verify it can receive/return the tokens before sending."
    );
    return { verdict: "REVIEW", reasons };
  }
  if (facts.destination.knownGood) {
    reasons.push(`Destination is a known-good contract (${facts.destination.knownGood}).`);
    return { verdict: "ALLOW", reasons };
  }
  reasons.push(
    facts.destination.isContract
      ? "Destination is an established contract. No fresh-deploy risk signal found."
      : "Destination is a standard externally owned account (EOA). No on-chain risk signal found."
  );
  return { verdict: "ALLOW", reasons };
}

// --- async orchestration --------------------------------------------------

export async function simulateIntent(intent: SimIntent): Promise<SimulationResult> {
  if (intent.type === "approve") {
    const token = getAddress(intent.token);
    const spenderAddr = getAddress(intent.spender);
    const meta = await getTokenMeta(token);
    const isUnlimited = isUnlimitedAmount(intent.amount, meta.decimals);
    const spender = await classifyAddress(spenderAddr);
    const { verdict, reasons } = evaluateApprove(spender, isUnlimited);
    return {
      verdict,
      reasons: [...reasons, ...spender.signals],
      wouldExposeUnlimited: isUnlimited,
      spenderClassification: spender,
      notChecked: [
        "Token-contract honesty (fee-on-transfer, blocklists, upgradeable logic) is not simulated.",
        "Your current balance and any existing allowance are not read — the intent carries no owner address.",
      ],
    };
  }

  // transfer
  const token = getAddress(intent.token);
  const to = getAddress(intent.to);
  const toIsZero = to.toLowerCase() === ZERO_ADDRESS;
  const toIsTokenContract = to.toLowerCase() === token.toLowerCase();
  const destination = await classifyAddress(to);
  const { verdict, reasons } = evaluateTransfer({ toIsZero, toIsTokenContract, destination });
  return {
    verdict,
    reasons: [...reasons, ...destination.signals],
    destinationClassification: destination,
    notChecked: [
      "Sender balance is not checked — the intent carries no `from` address.",
      "Whether a contract destination can receive/return the ERC-20 is not simulated.",
    ],
  };
}
