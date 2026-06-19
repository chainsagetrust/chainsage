/**
 * @chainsage/policy-engine — owner-defined rules, enforced deterministically.
 *
 * The trust layer (Phases 1–3) decides whether an action is *safe*. The policy
 * engine decides whether the owner has *authorized* it — so a person can delegate
 * to an agent without a human approval gate on every action.
 *
 *   import { evaluate } from "@chainsage/policy-engine";
 *   const { decision, firedRules } = evaluate(intent, policy, context);
 *   //        ^ ALLOW | REVIEW | DENY, with every rule that fired.
 *
 * Pure and deterministic. Precedence is absolute: DENY > REVIEW > ALLOW. The
 * caller supplies context facts (from Guardian's on-chain reads); the engine
 * does no I/O. See README.md for the honest scope of this phase.
 */
export { evaluate, worstDecision } from "./evaluate";
export {
  policyToJSON,
  policyFromJSON,
  type Policy,
  type PolicyContext,
  type PolicyEvaluation,
  type PolicyRuleId,
  type RuleHit,
  type SpendLimit,
  type FreshContractPolicy,
  type Address,
  type Decision,
  type Intent,
} from "./policy";
