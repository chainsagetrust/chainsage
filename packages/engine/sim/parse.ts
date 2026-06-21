/**
 * sim/parse — PURE, offline parsing + intent comparison. No network, no clock.
 *
 * Two responsibilities, both deterministic and unit-tested against fixtures:
 *   1. Reduce a raw provider response (Tenderly JSON / debug_traceCall tree) to a
 *      provider-agnostic `ParsedSim` (every transfer + approval + revert).
 *   2. `deriveEffects()` — compare that ParsedSim against the DECLARED intent and
 *      decide the lethal EffectFacts the combiner judges: hidden-transfer,
 *      intent-mismatch. (Honeypot is NOT derivable from a single approve/transfer
 *      sim — it needs a buy+sell round-trip — so it is honestly left unchecked.)
 *
 * Calibration of what counts as a mismatch / hidden transfer lives ONLY here, so
 * Tenderly and the RPC-trace path can never disagree about the same movements.
 */
import { decodeEventLog, getAddress, parseAbi, type Address } from "viem";
import { UNLIMITED_THRESHOLD } from "../chain";
import type { EffectFacts } from "../decide";
import {
  NATIVE_TOKEN,
  type ParsedSim,
  type RawApproval,
  type RawLog,
  type RawTransfer,
  type SimAction,
} from "./types";

const EVENTS_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

const sameAddr = (a?: string, b?: string): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** 1% relative tolerance for gas/rounding; expected==0 demands exactly 0. */
function withinTolerance(actual: bigint, expected: bigint): boolean {
  if (expected === 0n) return actual === 0n;
  const diff = actual > expected ? actual - expected : expected - actual;
  return diff * 100n <= expected;
}

// --- raw log decoding (shared by every provider) --------------------------

/**
 * Decode a flat list of raw EVM logs into Transfer/Approval movements. Unknown
 * events are skipped. This is the single decoder both providers funnel through.
 */
export function decodeLogs(logs: RawLog[]): { transfers: RawTransfer[]; approvals: RawApproval[] } {
  const transfers: RawTransfer[] = [];
  const approvals: RawApproval[] = [];
  for (const log of logs) {
    let decoded: ReturnType<typeof decodeEventLog>;
    try {
      decoded = decodeEventLog({
        abi: EVENTS_ABI,
        topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
        data: log.data,
      });
    } catch {
      continue; // not a Transfer/Approval we model — ignore
    }
    const token = getAddress(log.address);
    if (decoded.eventName === "Transfer") {
      const { from, to, value } = decoded.args as { from: Address; to: Address; value: bigint };
      transfers.push({ token, from: getAddress(from), to: getAddress(to), amount: value });
    } else if (decoded.eventName === "Approval") {
      const { owner, spender, value } = decoded.args as {
        owner: Address;
        spender: Address;
        value: bigint;
      };
      approvals.push({ token, owner: getAddress(owner), spender: getAddress(spender), amount: value });
    }
  }
  return { transfers, approvals };
}

// --- Tenderly response → ParsedSim ----------------------------------------

interface TenderlyRawLog {
  address?: string;
  topics?: readonly string[];
  data?: string;
}
interface TenderlyLog {
  raw?: TenderlyRawLog;
}
interface TenderlyAssetChange {
  type?: string;
  from?: string;
  to?: string;
  raw_amount?: string;
  rawAmount?: string;
  token_info?: { standard?: string; contract_address?: string };
}
interface TenderlyResponse {
  transaction?: {
    status?: boolean;
    error_message?: string;
    error_info?: { error_message?: string };
    transaction_info?: {
      logs?: TenderlyLog[] | null;
      asset_changes?: TenderlyAssetChange[] | null;
    };
  };
}

/**
 * Parse a Tenderly /simulate response. ERC-20 movements come from the decoded
 * logs (uniform with the trace path); native ETH movement comes from
 * asset_changes (which carry value transfers that emit no log).
 */
export function parseTenderlySimulation(input: unknown): ParsedSim {
  const resp = (input ?? {}) as TenderlyResponse;
  const tx = resp?.transaction;
  const reverted = tx?.status === false;
  const revertReason =
    tx?.error_message || tx?.error_info?.error_message || (reverted ? "execution reverted" : undefined);

  const rawLogs: RawLog[] = (tx?.transaction_info?.logs ?? [])
    .map((l) => l?.raw)
    .filter((r): r is TenderlyRawLog => !!r && !!r.address && Array.isArray(r.topics))
    .map((r) => ({
      address: getAddress(r.address as string),
      topics: (r.topics ?? []) as `0x${string}`[],
      data: (r.data ?? "0x") as `0x${string}`,
    }));

  const { transfers, approvals } = decodeLogs(rawLogs);

  // Native ETH value transfers (no log) come from asset_changes.
  for (const c of tx?.transaction_info?.asset_changes ?? []) {
    const standard = c?.token_info?.standard?.toLowerCase();
    const isNative = standard === "nativecurrency" || (!c?.token_info?.contract_address && !!c?.from);
    const amountStr = c?.raw_amount ?? c?.rawAmount;
    if (isNative && c?.from && c?.to && amountStr) {
      transfers.push({
        token: NATIVE_TOKEN,
        from: getAddress(c.from),
        to: getAddress(c.to),
        amount: BigInt(amountStr),
        native: true,
      });
    }
  }

  return { transfers, approvals, reverted, revertReason: reverted ? revertReason : undefined };
}

// --- debug_traceCall (callTracer, withLog) → ParsedSim --------------------

interface TraceFrame {
  type?: string;
  from?: string;
  to?: string;
  value?: string;
  error?: string;
  revertReason?: string;
  logs?: { address?: string; topics?: readonly string[]; data?: string }[];
  calls?: TraceFrame[];
}

/** Parse a debug_traceCall callTracer (withLog) result tree into a ParsedSim. */
export function parseTraceResult(input: unknown): ParsedSim {
  const top = (input ?? {}) as TraceFrame;
  const rawLogs: RawLog[] = [];
  const nativeTransfers: RawTransfer[] = [];

  const walk = (frame: TraceFrame): void => {
    for (const l of frame.logs ?? []) {
      if (l?.address && Array.isArray(l.topics)) {
        rawLogs.push({
          address: getAddress(l.address),
          topics: (l.topics ?? []) as `0x${string}`[],
          data: (l.data ?? "0x") as `0x${string}`,
        });
      }
    }
    // A call carrying non-zero value is a native ETH movement.
    if (frame.value && frame.from && frame.to) {
      let v = 0n;
      try {
        v = BigInt(frame.value);
      } catch {
        v = 0n;
      }
      if (v > 0n) {
        nativeTransfers.push({
          token: NATIVE_TOKEN,
          from: getAddress(frame.from),
          to: getAddress(frame.to),
          amount: v,
          native: true,
        });
      }
    }
    for (const c of frame.calls ?? []) walk(c);
  };
  walk(top);

  const { transfers, approvals } = decodeLogs(rawLogs);
  const reverted = !!top.error;
  return {
    transfers: [...transfers, ...nativeTransfers],
    approvals,
    reverted,
    revertReason: reverted ? top.revertReason || top.error : undefined,
  };
}

// --- the comparison: ParsedSim + declared intent → EffectFacts ------------

const HONEYPOT_NOT_CHECKED =
  "Honeypot (sell-path) detection is NOT performed: it requires a buy→sell round-trip simulation, which a single approve/transfer intent cannot exercise. The token's sell path was not tested.";

export interface DerivedEffects {
  effects: EffectFacts;
  outflows: RawTransfer[];
  approvals: RawApproval[];
  notChecked: string[];
}

/**
 * Compare what the simulation actually did against what the user DECLARED, and
 * decide the lethal EffectFacts. Strict on asset identity (token + counterparty);
 * 1% tolerant on amounts (gas/rounding). A reverting sim asserts no effects — the
 * revert itself is surfaced separately by the caller.
 */
export function deriveEffects(parsed: ParsedSim, action: SimAction): DerivedEffects {
  const notChecked = [HONEYPOT_NOT_CHECKED];

  if (parsed.reverted) {
    // Nothing executed — claim no honeypot/hidden/mismatch off a revert.
    return { effects: {}, outflows: [], approvals: [], notChecked };
  }

  const owner = action.owner;
  const outflows = parsed.transfers.filter((t) => sameAddr(t.from, owner));
  const ownerApprovals = parsed.approvals.filter((a) => sameAddr(a.owner, owner));

  let hasHiddenTransfer = false;
  let intentMismatch = false;

  if (action.kind === "transfer") {
    // Expected: exactly the declared token leaving owner to the declared `to`.
    const matched = outflows.find(
      (t) => sameAddr(t.token, action.token) && sameAddr(t.to, action.to)
    );

    // Funds reaching anyone other than the stated recipient, or a different
    // token leaving, or any approval granted by a "transfer" → hidden movement.
    const strayOutflow = outflows.some(
      (t) => !sameAddr(t.to, action.to) || !sameAddr(t.token, action.token)
    );
    if (strayOutflow || ownerApprovals.length > 0) hasHiddenTransfer = true;

    // The declared movement didn't happen, or arrived materially short
    // (fee-on-transfer / rebasing) → the net effect contradicts the intent.
    if (!matched) intentMismatch = true;
    else if (!withinTolerance(matched.amount, action.rawAmount)) intentMismatch = true;
  } else {
    // approve. Expected: a single Approval(owner → declared spender) on the
    // declared token, for ~the requested amount, and NO funds moving.
    const matched = ownerApprovals.find(
      (a) => sameAddr(a.token, action.token) && sameAddr(a.spender, action.spender)
    );

    // An approve must move no funds; any outflow is hidden value movement.
    if (outflows.length > 0) hasHiddenTransfer = true;

    // Any approval to a DIFFERENT spender or on a DIFFERENT token is hidden.
    const strayApproval = ownerApprovals.some(
      (a) => !sameAddr(a.spender, action.spender) || !sameAddr(a.token, action.token)
    );
    if (strayApproval) hasHiddenTransfer = true;

    if (!matched) {
      intentMismatch = true;
    } else {
      // Granting MORE than requested is dangerous over-approval (hidden).
      // Granting less is benign — not flagged. Unlimited requests expect ≥ the
      // unlimited threshold.
      const requested = action.unlimited
        ? action.rawAmount > UNLIMITED_THRESHOLD
          ? action.rawAmount
          : UNLIMITED_THRESHOLD
        : action.rawAmount;
      if (matched.amount > requested && !withinTolerance(matched.amount, requested)) {
        hasHiddenTransfer = true;
      }
    }
  }

  const effects: EffectFacts = {};
  if (hasHiddenTransfer) effects.hasHiddenTransfer = true;
  if (intentMismatch) effects.intentMismatch = true;

  return { effects, outflows, approvals: ownerApprovals, notChecked };
}
