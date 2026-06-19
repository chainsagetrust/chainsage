/**
 * @chainsage/trust-network — shared reputation that propagates across agents,
 * contracts, and protocols, so trust stops being computed alone.
 *
 *   import { computeAllTrust, reportIncident } from "@chainsage/trust-network";
 *   const scores = computeAllTrust(graph);              // TrustScore per entity
 *   const after  = computeAllTrust(reportIncident(c, graph)); // collapse + propagate
 *
 * Pure and deterministic: same graph → same scores. Propagation is bounded (a
 * contraction with α<1 over capped iterations). This is the FOUNDATION of a
 * trust network — a real, tested engine. Becoming the *default standard* requires
 * adoption, multi-party participation, and time. See README.md.
 */
export {
  computeTrust,
  computeAllTrust,
  reportIncident,
  INCIDENT_REPORTER,
  NEUTRAL,
  INCIDENT_CAP,
  PROPAGATION_ALPHA,
  PROPAGATION_ITERATIONS,
  type ComputeOptions,
  type IncidentOptions,
} from "./compute";

export { verdictToSignal, subjectOf, type ObservedOutcome } from "./ingest";

export {
  makeGraph,
  addSignal,
  ensureEntity,
  getEntity,
  lc,
  type Entity,
  type EntityKind,
  type Signal,
  type SignalType,
  type TrustScore,
  type TrustGraph,
  type Address,
} from "./model";
