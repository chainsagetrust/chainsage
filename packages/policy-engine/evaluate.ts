/**
 * @chainsage/policy-engine — the evaluator. PURE and DETERMINISTIC: same
 * (intent, policy, context) always yields the same result. No I/O, no clock,
 * no randomness. The caller supplies facts; the engine only decides.
 *
 * ── Precedence is absolute: DENY > REVIEW > ALLOW. ──
 * The final decision is the worst-ranked decision among the rules that fired,
 * defaulting to ALLOW when none fired. Because a single DENY outranks any number
 * of REVIEWs and ALLOWs, this is correct by construction and is proven
 * exhaustively in evaluate.test.ts.
 *
 * Rule catalogue (trigger → decision):
 *   blocked-protocol .......... counterparty on denylist            → DENY
 *   unlimited-approval ........ unlimited approve & allowUnlimited=false → DENY
 *   fresh-contract ............ fresh counterparty & policy "deny"   → DENY
 *                                                  & policy "review" → REVIEW
 *   spend-per-tx .............. amount > maxPerTx for the token      → DENY
 *   spend-per-day ............. spentToday + amount > maxPerDay      → DENY
 *   chain-not-allowed ......... chain not in allowedChains           → DENY
 *   protocol-not-allowlisted .. counterparty not in allowedProtocols → REVIEW
 *   low-trust ................. counterpartyTrust < trustThreshold   → REVIEW
 *   (nothing fired) ........................................         → ALLOW
 */
import type { Address, Decision, Intent } from "chainsage";
import type {
  Policy,
  PolicyContext,
  PolicyEvaluation,
  RuleHit,
} from "./policy";

/** Decision precedence. Higher rank wins. This ordering IS the safety contract. */
const RANK: Record<Decision, number> = { ALLOW: 0, REVIEW: 1, DENY: 2 };

/** Return the higher-precedence (worse) of two decisions. */
export function worstDecision(a: Decision, b: Decision): Decision {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * The facets of an intent the engine reasons about. Extracting these once keeps
 * each intent kind's quirks in a single honest place — e.g. a swap intent
 * carries no router/spender, so its `counterparty` is null and the
 * protocol/trust rules cannot fire on it (matching the SDK's swap honesty).
 */
interface IntentFacets {
  chain: string;
  /** Spender/router/destination relevant to allow/deny lists & trust, or null. */
  counterparty: Address | null;
  /** Token whose value moves (for spend caps), or null when none applies. */
  token: Address | null;
  /** Amount of `token` moving; "unlimited" for an unbounded approval; null if N/A. */
  amount: bigint | "unlimited" | null;
  /** True when this intent is an unlimited approval. */
  isUnlimitedApproval: boolean;
}

function intentFacets(intent: Intent): IntentFacets {
  switch (intent.kind) {
    case "approve":
      return {
        chain: intent.chain,
        counterparty: intent.spender,
        token: intent.token,
        amount: intent.amount,
        isUnlimitedApproval: intent.amount === "unlimited",
      };
    case "transfer":
      return {
        chain: intent.chain,
        counterparty: intent.to,
        token: intent.token,
        amount: intent.amount,
        isUnlimitedApproval: false,
      };
    case "swap":
      // A swap intent carries no router/spender, so no counterparty to allow/deny
      // or trust-check. The value that moves is amountIn of tokenIn.
      return {
        chain: intent.chain,
        counterparty: null,
        token: intent.tokenIn,
        amount: intent.amountIn,
        isUnlimitedApproval: false,
      };
    case "x402_pay":
      // Forward-looking native-value payment: no token contract, so spend caps
      // (which are token-keyed) cannot match. The destination is the counterparty.
      return {
        chain: intent.chain,
        counterparty: intent.to,
        token: null,
        amount: intent.amount,
        isUnlimitedApproval: false,
      };
  }
}

function eqAddr(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function listIncludes(list: Address[] | undefined, addr: Address): boolean {
  return !!list && list.some((entry) => eqAddr(entry, addr));
}

/**
 * Evaluate an intent against a policy and the supplied context facts.
 *
 * Collects EVERY rule that fired (not just the deciding one) so the verdict can
 * be explained in full, then resolves the decision strictly by precedence.
 */
export function evaluate(
  intent: Intent,
  policy: Policy,
  context: PolicyContext = {}
): PolicyEvaluation {
  const f = intentFacets(intent);
  const fired: RuleHit[] = [];

  // 1. Blocked protocol — denylist always wins. (DENY)
  if (f.counterparty && listIncludes(policy.blockedProtocols, f.counterparty)) {
    fired.push({
      rule: "blocked-protocol",
      decision: "DENY",
      reason: `Counterparty ${f.counterparty} is on the blocked-protocol denylist.`,
      detail: { counterparty: f.counterparty },
    });
  }

  // 2. Unlimited approval when the owner forbids them. (DENY)
  if (f.isUnlimitedApproval && policy.approvalRules?.allowUnlimited === false) {
    fired.push({
      rule: "unlimited-approval",
      decision: "DENY",
      reason:
        "Unlimited approval requested, but this policy forbids unlimited approvals (allowUnlimited = false).",
      detail: { token: f.token, counterparty: f.counterparty },
    });
  }

  // 3. Fresh contract — only when the fact is known AND the policy constrains it.
  if (context.counterpartyIsFresh === true && policy.freshContractPolicy && policy.freshContractPolicy !== "allow") {
    const decision = policy.freshContractPolicy === "deny" ? "DENY" : "REVIEW";
    fired.push({
      rule: "fresh-contract",
      decision,
      reason: `Counterparty is a freshly deployed contract; policy says fresh contracts → ${decision}.`,
      detail: { counterparty: f.counterparty, freshContractPolicy: policy.freshContractPolicy },
    });
  }

  // 4 & 5. Spend limits — only when this token has a configured cap. (DENY)
  if (f.token && policy.spendLimits && policy.spendLimits.length > 0) {
    const limit = policy.spendLimits.find((l) => eqAddr(l.token, f.token as Address));
    if (limit) {
      const isUnlimited = f.amount === "unlimited";
      const amount: bigint | null = f.amount === "unlimited" ? null : f.amount ?? 0n;

      // per-transaction cap
      if (isUnlimited || (amount !== null && amount > limit.maxPerTx)) {
        fired.push({
          rule: "spend-per-tx",
          decision: "DENY",
          reason: isUnlimited
            ? `Unlimited amount exceeds the per-transaction cap (${limit.maxPerTx}) for token ${f.token}.`
            : `Amount ${amount} exceeds the per-transaction cap (${limit.maxPerTx}) for token ${f.token}.`,
          detail: { token: f.token, amount: isUnlimited ? "unlimited" : amount?.toString(), maxPerTx: limit.maxPerTx.toString() },
        });
      }

      // per-day cumulative cap
      const spentToday = context.spentTodayByToken?.[f.token.toLowerCase()] ?? 0n;
      if (isUnlimited || (amount !== null && spentToday + amount > limit.maxPerDay)) {
        fired.push({
          rule: "spend-per-day",
          decision: "DENY",
          reason: isUnlimited
            ? `Unlimited amount exceeds the per-day cap (${limit.maxPerDay}) for token ${f.token}.`
            : `Today's spend ${spentToday} + ${amount} exceeds the per-day cap (${limit.maxPerDay}) for token ${f.token}.`,
          detail: {
            token: f.token,
            amount: isUnlimited ? "unlimited" : amount?.toString(),
            spentToday: spentToday.toString(),
            maxPerDay: limit.maxPerDay.toString(),
          },
        });
      }
    }
  }

  // 6. Chain allowlist — when set, anything off-list is denied. (DENY)
  if (policy.allowedChains && policy.allowedChains.length > 0 && !policy.allowedChains.includes(f.chain)) {
    fired.push({
      rule: "chain-not-allowed",
      decision: "DENY",
      reason: `Chain "${f.chain}" is not in the allowed-chains list (${policy.allowedChains.join(", ")}).`,
      detail: { chain: f.chain, allowedChains: policy.allowedChains },
    });
  }

  // 7. Protocol allowlist — off-list counterparty is unknown, not forbidden. (REVIEW)
  if (
    policy.allowedProtocols &&
    policy.allowedProtocols.length > 0 &&
    f.counterparty &&
    !listIncludes(policy.allowedProtocols, f.counterparty)
  ) {
    fired.push({
      rule: "protocol-not-allowlisted",
      decision: "REVIEW",
      reason: `Counterparty ${f.counterparty} is not on the protocol allowlist — unknown, escalate for review.`,
      detail: { counterparty: f.counterparty },
    });
  }

  // 8. Low counterparty trust — only when both threshold and score are known. (REVIEW)
  if (
    typeof policy.trustThreshold === "number" &&
    typeof context.counterpartyTrust === "number" &&
    context.counterpartyTrust < policy.trustThreshold
  ) {
    fired.push({
      rule: "low-trust",
      decision: "REVIEW",
      reason: `Counterparty trust ${context.counterpartyTrust} is below the required threshold ${policy.trustThreshold}.`,
      detail: { trust: context.counterpartyTrust, trustThreshold: policy.trustThreshold },
    });
  }

  const decision = fired.reduce<Decision>((acc, hit) => worstDecision(acc, hit.decision), "ALLOW");
  return { decision, firedRules: fired, intent };
}
