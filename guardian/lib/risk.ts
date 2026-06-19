/**
 * Re-export shim → @chainsage/engine (the single source of truth).
 *
 * The verdict engine lives in packages/engine now, shared with the Risk API.
 * This file exists only so existing `@/lib/risk` imports keep working.
 */
export * from "@chainsage/engine/risk";
