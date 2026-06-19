/**
 * classify — "is this spender/contract risky?"
 *
 * Grounded in ON-CHAIN READS ONLY:
 *   - isContract: does the address have deployed bytecode? (eth_getCode)
 *   - ageDays:    bounded contract-age estimate via bytecode sampling
 *   - knownGood:  curated allowlist hit (Permit2, Uniswap routers on Base)
 *
 * classifySpender() is PURE (facts → verdict) so it is unit-tested against a
 * calibration table. classifyAddress() does the reads, then calls it. Shared by
 * the Risk API and the Agent SDK — there is no second copy.
 */
import { getAddress, type Address } from "viem";
import { isContract, getContractAgeDays, knownGoodSpender } from "./chain";
import type { Verdict } from "./verdict";

/** Matches Guardian's fresh-contract threshold so verdicts stay consistent. */
export const FRESH_THRESHOLD_DAYS = 7;

export interface SpenderFacts {
  isContract: boolean;
  /** Bounded age estimate in days; null for an EOA or when unbounded. */
  ageDays: number | null;
  /** Allowlist label if this address is known-good, else null. */
  knownGoodName: string | null;
}

export interface Classification {
  verdict: Verdict;
  isContract: boolean;
  ageDays: number | null;
  isFresh: boolean;
  knownGood: string | null;
  signals: string[];
}

/**
 * Pure verdict logic for a spender/contract:
 *   - EOA                         → REVIEW (atypical spender)
 *   - known-good contract         → ALLOW
 *   - fresh contract (<7d)        → REVIEW (strongest drainer signal)
 *   - established contract (≥7d)  → ALLOW (no fresh-deploy signal)
 *
 * The lethal pattern (fresh + unlimited) escalates to DENY only in simulate,
 * where the allowance amount is known — matching the Guardian calibration.
 */
export function classifySpender(facts: SpenderFacts): Classification {
  const signals: string[] = [];
  const isFresh =
    facts.isContract &&
    facts.ageDays !== null &&
    facts.ageDays < FRESH_THRESHOLD_DAYS;

  if (!facts.isContract) {
    signals.push(
      "Externally owned account (EOA), not a contract. An EOA spender can still pull approved tokens by sending its own transactions, which is uncommon for a legitimate protocol — verify before trusting."
    );
    return {
      verdict: "REVIEW",
      isContract: false,
      ageDays: null,
      isFresh: false,
      knownGood: null,
      signals,
    };
  }

  signals.push("Address has deployed bytecode (it is a contract).");

  let verdict: Verdict;
  if (facts.knownGoodName) {
    signals.push(`Known-good spender: ${facts.knownGoodName}.`);
    verdict = "ALLOW";
  } else if (isFresh) {
    signals.push(
      `Freshly deployed contract — under ${FRESH_THRESHOLD_DAYS} days old (bounded estimate: ~${facts.ageDays}d). Newly deployed spenders are the single strongest wallet-drainer signal.`
    );
    verdict = "REVIEW";
  } else {
    const ageLabel =
      facts.ageDays === null ? "age not bounded" : `at least ~${facts.ageDays}d old`;
    signals.push(
      `Established contract (${ageLabel}), not on the known-good allowlist. No fresh-deploy drainer signal.`
    );
    verdict = "ALLOW";
  }

  return {
    verdict,
    isContract: true,
    ageDays: facts.ageDays,
    isFresh,
    knownGood: facts.knownGoodName,
    signals,
  };
}

/** Gather on-chain facts for `addr`, then classify. */
export async function classifyAddress(addr: Address): Promise<Classification> {
  const address = getAddress(addr);
  const contract = await isContract(address);
  const ageDays = contract ? await getContractAgeDays(address) : null;
  const knownGoodName = knownGoodSpender(address);
  return classifySpender({ isContract: contract, ageDays, knownGoodName });
}
