/**
 * @chainsage/policy-engine — Policy & context types.
 *
 * A `Policy` is an owner's standing ruleset: the constraints an agent must obey
 * so a human can delegate WITHOUT approving every action by hand. The engine
 * evaluates an `Intent` (the SDK's type — there is no parallel definition here)
 * against a `Policy` plus a `PolicyContext` of facts the caller supplies (the
 * facts come from Guardian's on-chain reads; the engine itself does no I/O).
 *
 * Precedence is the whole point and is ABSOLUTE: DENY > REVIEW > ALLOW. A single
 * DENY rule overrides any number of REVIEWs and ALLOWs. See evaluate.ts.
 */
import type { Address, Decision, Intent } from "chainsage";

export type { Address, Decision, Intent };

/** What to do when a spender/counterparty is a freshly deployed contract. */
export type FreshContractPolicy = "deny" | "review" | "allow";

/** A per-token spend cap. Amounts are RAW token units (bigint), like the chain. */
export interface SpendLimit {
  token: Address;
  /** Max value, in raw units, that may move in a single transaction. */
  maxPerTx: bigint;
  /** Max cumulative value, in raw units, that may move across one day. */
  maxPerDay: bigint;
}

/**
 * The owner's standing policy. Every field is OPTIONAL and an absent or empty
 * field means "no constraint" — so an empty policy `{}` evaluates to ALLOW for
 * everything. This permissive default is a deliberate, documented choice: a
 * policy only ever *adds* restrictions; it never silently denies.
 */
export interface Policy {
  /** Per-token caps. An empty/absent list imposes no spend constraint. */
  spendLimits?: SpendLimit[];
  /** Allowlist of chains. When set (non-empty), any other chain → DENY. */
  allowedChains?: string[];
  /** Allowlist of spenders/routers. When set, an off-list counterparty → REVIEW (unknown, not forbidden). */
  allowedProtocols?: Address[];
  /** Denylist of spenders/routers. A hit always → DENY (takes precedence). */
  blockedProtocols?: Address[];
  /** Approval rules. `allowUnlimited: false` makes any unlimited approval → DENY. */
  approvalRules?: { allowUnlimited: boolean };
  /** Minimum counterparty trust score (0–1) to avoid REVIEW. */
  trustThreshold?: number;
  /** How to treat a freshly deployed counterparty contract. Absent ⇒ no constraint. */
  freshContractPolicy?: FreshContractPolicy;
}

/**
 * Facts the caller supplies for one evaluation. The engine NEVER fetches these —
 * they are computed via Guardian's reads (`@chainsage/engine`) and passed in,
 * which is what keeps the engine pure, fast, and exhaustively testable.
 *
 * A fact that is absent (`undefined`) means "not known"; the corresponding rule
 * simply does not fire on that ground. The engine does not invent facts.
 */
export interface PolicyContext {
  /** True if the intent's counterparty is a freshly deployed contract. */
  counterpartyIsFresh?: boolean;
  /** Counterparty trust score in [0,1]. Higher = more trusted. */
  counterpartyTrust?: number;
  /**
   * Cumulative spend already made TODAY, keyed by lowercased token address, in
   * raw units. Used for the per-day cap. Absent token ⇒ nothing spent yet.
   */
  spentTodayByToken?: Record<string, bigint>;
}

/** Stable id for each rule the engine can fire. One id per distinct rule. */
export type PolicyRuleId =
  | "blocked-protocol"
  | "unlimited-approval"
  | "fresh-contract"
  | "spend-per-tx"
  | "spend-per-day"
  | "chain-not-allowed"
  | "protocol-not-allowlisted"
  | "low-trust";

/**
 * A rule that fired. Only REVIEW and DENY rules ever "fire" — ALLOW is the
 * default, i.e. the absence of any fired rule. `firedRules` therefore lists
 * exactly the restrictions that were triggered, so the UI can explain the
 * verdict in full, not just the deciding rule.
 */
export interface RuleHit {
  rule: PolicyRuleId;
  decision: Exclude<Decision, "ALLOW">;
  /** Human-readable explanation of why this rule fired. */
  reason: string;
  /** Structured detail for the UI (addresses, amounts, thresholds). */
  detail?: Record<string, unknown>;
}

/** The result of evaluating one intent against a policy + context. */
export interface PolicyEvaluation {
  /** ALLOW / REVIEW / DENY — the worst (highest-precedence) fired decision, else ALLOW. */
  decision: Decision;
  /** Every rule that fired (REVIEW/DENY), in a deterministic order. */
  firedRules: RuleHit[];
  /** The exact intent evaluated, echoed for auditability. */
  intent: Intent;
}

// --- serialization --------------------------------------------------------
//
// `bigint` does not survive JSON.stringify, so the builder UI and any storage
// layer go through these helpers. They are pure (no I/O) and round-trip exact.

/** Serialize a Policy to pretty JSON, encoding bigint spend limits as strings. */
export function policyToJSON(policy: Policy): string {
  return JSON.stringify(
    policy,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
}

/**
 * Parse a Policy from JSON produced by policyToJSON (or hand-written), coercing
 * the string-encoded spend-limit amounts back to bigint. Throws on malformed
 * spend-limit amounts so a bad policy can never silently evaluate as permissive.
 */
export function policyFromJSON(json: string): Policy {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const policy: Policy = { ...(raw as Policy) };
  if (Array.isArray(raw.spendLimits)) {
    policy.spendLimits = raw.spendLimits.map((entry) => {
      const e = entry as { token: Address; maxPerTx: unknown; maxPerDay: unknown };
      return {
        token: e.token,
        maxPerTx: toBigint(e.maxPerTx, "maxPerTx"),
        maxPerDay: toBigint(e.maxPerDay, "maxPerDay"),
      };
    });
  }
  return policy;
}

function toBigint(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return BigInt(value.trim());
  throw new Error(`Invalid spend-limit ${field}: ${JSON.stringify(value)} (expected an integer).`);
}
