/**
 * @chainsage/trust-network — data model.
 *
 * A trust graph is a set of `Entity` nodes (agents / contracts / protocols /
 * wallets) and a list of `Signal` edges (verdict outcomes, attestations,
 * incidents). The reputation engine (compute.ts) turns this graph into a
 * `TrustScore` per entity. Everything here is plain serializable data so the
 * graph can be persisted, shipped to the browser, and diffed deterministically.
 *
 * Addresses are the entity identity and are reused from the SDK (`chainsage`) —
 * there is one definition of `Address` across ChainSage.
 */
import type { Address } from "chainsage";

export type { Address };

export type EntityKind = "agent" | "contract" | "protocol" | "wallet";

export interface Entity {
  id: Address;
  kind: EntityKind;
  /** Unix ms when first observed. Metadata only — not used by the score math. */
  firstSeen: number;
  /** Human label (real protocol/contract name where known). */
  label?: string;
  /** True when this node is REAL on-chain Base data; false when seeded for demo density. */
  real?: boolean;
}

export type SignalType = "verdict_outcome" | "attestation" | "incident";

export interface Signal {
  /** Who is making the claim. */
  from: Address;
  /** Who the claim is about. */
  about: Address;
  type: SignalType;
  /** Signal strength (>= 0). Capped per-source by the engine to resist spam. */
  weight: number;
  /** Outcome value in [-1, 1]: incidents negative, good outcomes positive. */
  value: number;
  /** Unix ms. Metadata; the engine is order- and time-independent. */
  at: number;
}

export interface TrustScore {
  entity: Address;
  /** 0..1 — propagated reputation. 0.5 is neutral / unknown. */
  score: number;
  /** 0..1 — how much independent evidence backs the score. */
  confidence: number;
  /** Count of distinct independent (non-self) sources with signals about this entity. */
  contributors: number;
}

export interface TrustGraph {
  entities: Entity[];
  signals: Signal[];
}

// --- helpers (pure) -------------------------------------------------------

export function lc(addr: Address): string {
  return addr.toLowerCase();
}

export function makeGraph(entities: Entity[] = [], signals: Signal[] = []): TrustGraph {
  return { entities, signals };
}

/** Return a NEW graph with `signal` appended (the engine never mutates input). */
export function addSignal(graph: TrustGraph, signal: Signal): TrustGraph {
  return { entities: graph.entities, signals: [...graph.signals, signal] };
}

/** Return a NEW graph with an entity added if its address is not already present. */
export function ensureEntity(graph: TrustGraph, entity: Entity): TrustGraph {
  if (graph.entities.some((e) => lc(e.id) === lc(entity.id))) return graph;
  return { entities: [...graph.entities, entity], signals: graph.signals };
}

export function getEntity(graph: TrustGraph, id: Address): Entity | undefined {
  return graph.entities.find((e) => lc(e.id) === lc(id));
}
