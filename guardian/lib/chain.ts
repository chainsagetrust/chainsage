/**
 * Re-export shim → @chainsage/engine (the single source of truth).
 *
 * Guardian's on-chain core lives in packages/engine now, shared with the Risk
 * API so there is exactly one copy of the verdict logic and the Base reads.
 * This file exists only so existing `@/lib/chain` imports keep working.
 */
export * from "@chainsage/engine/chain";
