/**
 * Re-export shim → @chainsage/engine (the single source of truth).
 *
 * The simulate logic moved into packages/engine so the Risk API and the Agent
 * SDK share one copy. This file exists only so existing `@/lib/simulate`
 * imports keep working.
 */
export * from "@chainsage/engine/simulate";
