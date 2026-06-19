/**
 * @chainsage/trust-network — the reputation engine. PURE and DETERMINISTIC:
 * the same graph always yields the same scores. No I/O, no clock, no randomness.
 *
 * A trust score has two parts:
 *   1. DIRECT score   — from the signals about the entity itself.
 *   2. PROPAGATED part — bounded, decaying spread of trust across graph edges,
 *                        PageRank-style, so a trusted neighbourhood lifts you and
 *                        a drained neighbour drags you down (negative propagation).
 *
 * ── Boundedness (why it can't run away or oscillate) ──
 * Propagation is the affine iteration  s ← (1-α)·d + α·P·s  where P is a
 * row-stochastic neighbour-weight matrix and α < 1. Its spectral radius is ≤ α,
 * so it is a contraction with a unique fixed point in [0,1]. We run a fixed,
 * capped number of iterations — deterministic, convergent, no overflow.
 *
 * ── Anti-gaming (partial, by design — see README "Unsolved problems") ──
 *   - Self-attestation cap: a signal from an entity about itself contributes a
 *     tiny capped weight, so no one can self-vouch to high trust.
 *   - Per-source weight cap: one source can't out-shout the rest by spamming.
 *   - Source credibility weighting: a voter's influence scales with its OWN
 *     direct score, so a cloud of brand-new (neutral) addresses counts for less.
 *   - Confidence tracks INDEPENDENT contributors, shown honestly — few signals
 *     never reads as high confidence.
 * These raise the cost of gaming; they do NOT solve sybil clusters of many
 * funded, aged, mutually-attesting addresses, wash-trust, or signal authenticity.
 * Those are named, unsolved, in the README. A trust system that hid them would
 * be the opposite of trustworthy.
 */
import type { Address } from "chainsage";
import { lc, type TrustGraph, type TrustScore, type Signal } from "./model";
import { addSignal } from "./model";

// --- tunable constants (documented; changing them changes nothing's determinism) ---
export const NEUTRAL = 0.5; // score for an entity we know nothing about
export const SELF_SIGNAL_CAP = 0.15; // max effective weight of a self-attestation
export const MAX_SOURCE_WEIGHT = 3; // max effective weight from one source about one entity
export const PROPAGATION_ALPHA = 0.4; // neighbour pull (damping). <1 keeps it a contraction.
export const PROPAGATION_ITERATIONS = 12; // capped depth; plenty to converge for real graphs
export const INCIDENT_CAP = 0.08; // an entity with an active incident can score no higher
export const CONFIDENCE_K = 2; // contributors needed for ~0.5 confidence
export const PRIOR_WEIGHT = 1; // pseudo-observation at NEUTRAL: low evidence stays near neutral
export const DEFAULT_INCIDENT_WEIGHT = 6; // weight of the signal reportIncident injects

/**
 * The network's incident oracle — a sentinel "reporter" address. Incidents are
 * attributed to it (not to the entity itself, which the self-cap would mute) and
 * it is treated as a fully credible source. In production this would be a set of
 * independent, authenticated reporters; here it is one labelled sentinel.
 */
export const INCIDENT_REPORTER = "0xC8A1A6E5000000000000000000000000000000FF" as Address;

interface SourceAgg {
  /** weighted-average value in [-1,1] of this source's signals about the entity */
  value: number;
  /** effective weight after per-source + self caps */
  weight: number;
  isSelf: boolean;
  isReporter: boolean;
}

interface DirectResult {
  d0: number; // raw direct score (pass A)
  d: number; // credibility-weighted direct score (pass B)
  contributors: number;
  confidence: number;
  hasIncident: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const toUnit = (signed: number) => (signed + 1) / 2; // [-1,1] → [0,1]

/** All addresses that appear as an entity or anywhere in a signal. */
function allAddresses(graph: TrustGraph): string[] {
  const set = new Set<string>();
  for (const e of graph.entities) set.add(lc(e.id));
  for (const s of graph.signals) {
    set.add(lc(s.from));
    set.add(lc(s.about));
  }
  // Sorted for stable, reproducible output construction.
  return [...set].sort();
}

/** Group signals about each entity, by source, applying the self & per-source caps. */
function aggregateBySource(graph: TrustGraph): Map<string, Map<string, SourceAgg>> {
  // about -> from -> {Σw, Σ(w·v)}
  const acc = new Map<string, Map<string, { sw: number; swv: number }>>();
  for (const sig of graph.signals) {
    const about = lc(sig.about);
    const from = lc(sig.from);
    const w = Math.max(0, sig.weight);
    if (w === 0) continue;
    let bySource = acc.get(about);
    if (!bySource) acc.set(about, (bySource = new Map()));
    const cur = bySource.get(from) ?? { sw: 0, swv: 0 };
    cur.sw += w;
    cur.swv += w * sig.value;
    bySource.set(from, cur);
  }

  const out = new Map<string, Map<string, SourceAgg>>();
  for (const [about, bySource] of acc) {
    const m = new Map<string, SourceAgg>();
    for (const [from, { sw, swv }] of bySource) {
      const isSelf = from === about;
      const isReporter = from === lc(INCIDENT_REPORTER);
      let weight = Math.min(sw, MAX_SOURCE_WEIGHT);
      if (isSelf) weight = Math.min(weight, SELF_SIGNAL_CAP);
      const value = sw > 0 ? swv / sw : 0; // weighted-average value, in [-1,1]
      m.set(from, { value, weight, isSelf, isReporter });
    }
    out.set(about, m);
  }
  return out;
}

function hasNegativeIncident(graph: TrustGraph, about: string): boolean {
  return graph.signals.some((s) => lc(s.about) === about && s.type === "incident" && s.value < 0);
}

/** Compute direct (own-signal) scores for every entity, with anti-gaming caps. */
function computeDirect(graph: TrustGraph, addresses: string[]): Map<string, DirectResult> {
  const bySource = aggregateBySource(graph);
  const incident = new Set(addresses.filter((a) => hasNegativeIncident(graph, a)));

  // PASS A — raw direct score d0 (no source-credibility weighting yet).
  // A NEUTRAL prior of weight PRIOR_WEIGHT pulls low-evidence scores toward 0.5,
  // so a single source (even one flooding signals) cannot reach an extreme score
  // on its own — this is what makes self-attestation ineffective, not just capped.
  const d0 = new Map<string, number>();
  for (const about of addresses) {
    const sources = bySource.get(about);
    let numer = 0;
    let denom = 0;
    if (sources) {
      for (const agg of sources.values()) {
        numer += agg.weight * agg.value;
        denom += agg.weight;
      }
    }
    let score = toUnit(numer / (denom + PRIOR_WEIGHT));
    if (incident.has(about)) score = Math.min(score, INCIDENT_CAP);
    d0.set(about, score);
  }

  // PASS B — credibility-weighted direct score d: a source's vote scales with its
  // OWN direct score (the reporter sentinel is fully credible). This is what makes
  // a swarm of neutral, no-history addresses count for little.
  const out = new Map<string, DirectResult>();
  for (const about of addresses) {
    const sources = bySource.get(about);
    let numer = 0;
    let denom = 0;
    let contributors = 0;
    if (sources) {
      for (const [from, agg] of sources) {
        if (!agg.isSelf && agg.weight > 0) contributors++;
        const cred = agg.isReporter ? 1 : d0.get(from) ?? NEUTRAL;
        const w = agg.weight * cred;
        numer += w * agg.value;
        denom += w;
      }
    }
    let d = toUnit(numer / (denom + PRIOR_WEIGHT));
    if (incident.has(about)) d = Math.min(d, INCIDENT_CAP);
    const confidence = contributors / (contributors + CONFIDENCE_K);
    out.set(about, { d0: d0.get(about) ?? NEUTRAL, d, contributors, confidence, hasIncident: incident.has(about) });
  }
  return out;
}

/** Undirected neighbour weights: a(e,n) = Σ|weight| of signals strictly between e and n. */
function buildAdjacency(graph: TrustGraph): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  const link = (a: string, b: string, w: number) => {
    let m = adj.get(a);
    if (!m) adj.set(a, (m = new Map()));
    m.set(b, (m.get(b) ?? 0) + w);
  };
  for (const sig of graph.signals) {
    const a = lc(sig.from);
    const b = lc(sig.about);
    if (a === b) continue; // self-loops don't form propagation edges
    const w = Math.abs(sig.weight);
    if (w === 0) continue;
    link(a, b, w);
    link(b, a, w);
  }
  return adj;
}

export interface ComputeOptions {
  /** Override iteration count (testing convergence). Defaults to PROPAGATION_ITERATIONS. */
  iterations?: number;
}

/** Compute trust scores for EVERY entity/address in the graph. Deterministic. */
export function computeAllTrust(graph: TrustGraph, opts: ComputeOptions = {}): Map<string, TrustScore> {
  const addresses = allAddresses(graph);
  const direct = computeDirect(graph, addresses);
  const adj = buildAdjacency(graph);
  const iterations = opts.iterations ?? PROPAGATION_ITERATIONS;

  // Propagation: synchronous (uses previous iteration's values), so iteration
  // order cannot affect the result. Incident nodes are clamped every step so a
  // drainer can never be rehabilitated by the trust of its victims.
  let prev = new Map<string, number>();
  for (const a of addresses) prev.set(a, direct.get(a)!.d);

  for (let t = 0; t < iterations; t++) {
    const next = new Map<string, number>();
    for (const a of addresses) {
      const d = direct.get(a)!.d;
      const neighbours = adj.get(a);
      let score: number;
      if (neighbours && neighbours.size > 0) {
        let wnum = 0;
        let wden = 0;
        for (const [n, w] of neighbours) {
          wnum += w * (prev.get(n) ?? NEUTRAL);
          wden += w;
        }
        const nb = wden > 0 ? wnum / wden : NEUTRAL;
        score = (1 - PROPAGATION_ALPHA) * d + PROPAGATION_ALPHA * nb;
      } else {
        score = d; // unconnected node: its score is purely its own evidence
      }
      if (direct.get(a)!.hasIncident) score = Math.min(score, INCIDENT_CAP);
      next.set(a, clamp01(score));
    }
    prev = next;
  }

  const result = new Map<string, TrustScore>();
  for (const a of addresses) {
    const dr = direct.get(a)!;
    result.set(a, {
      entity: a as Address,
      score: round(prev.get(a)!),
      confidence: round(dr.confidence),
      contributors: dr.contributors,
    });
  }
  return result;
}

/** Compute the trust score for a single entity. Unknown entity → neutral, zero confidence. */
export function computeTrust(entity: Address, graph: TrustGraph): TrustScore {
  const all = computeAllTrust(graph);
  return (
    all.get(lc(entity)) ?? { entity, score: NEUTRAL, confidence: 0, contributors: 0 }
  );
}

export interface IncidentOptions {
  weight?: number;
  /** Unix ms for the injected signal (caller-supplied so the engine stays pure). */
  at?: number;
  /** Severity in (0,1]; scales how negative the incident value is. Default 1 (max). */
  severity?: number;
}

/**
 * Report a drainer/exploit incident about `contract`. Returns a NEW graph with a
 * strong negative incident signal from the incident-reporter sentinel. Recompute
 * the graph (computeAllTrust) to see the contract's score collapse and the
 * negative signal propagate to its neighbours with distance decay.
 */
export function reportIncident(contract: Address, graph: TrustGraph, opts: IncidentOptions = {}): TrustGraph {
  const severity = clamp01(opts.severity ?? 1);
  const signal: Signal = {
    from: INCIDENT_REPORTER,
    about: contract,
    type: "incident",
    weight: opts.weight ?? DEFAULT_INCIDENT_WEIGHT,
    value: -severity,
    at: opts.at ?? 0,
  };
  return addSignal(graph, signal);
}

function round(x: number): number {
  // 6 dp — keeps determinism crisp and serialization tidy without lossy display.
  return Math.round(x * 1e6) / 1e6;
}
