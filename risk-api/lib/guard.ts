/**
 * Re-export shim → @chainsage/engine (the single source of truth).
 *
 * The Guardian verdict combiner (decide) and its signal-gathering (guardIntent)
 * live in packages/engine, shared with the Agent SDK. This file exists only so
 * the route can import `@/lib/guard` consistently with the other endpoints.
 */
export * from "@chainsage/engine/guard";
export * from "@chainsage/engine/decide";
