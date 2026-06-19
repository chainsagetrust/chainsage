/**
 * The reputation-engine suite. If propagation isn't deterministic and bounded,
 * the engine is broken — these prove it before any UI touches it.
 *
 *   1. Determinism + order-independence  (same graph → same scores, always)
 *   2. Bounded propagation               (scores stay in [0,1]; converges)
 *   3. Incident decay                    (collapse + neighbour drag + distance decay + isolation)
 *   4. Confidence scaling                (more independent contributors → more confidence)
 *   5. Self-attestation cap              (you cannot self-vouch to high trust)
 *   6. Purity                            (reportIncident never mutates the input graph)
 */
import { describe, it, expect } from "vitest";
import {
  computeAllTrust,
  computeTrust,
  reportIncident,
  INCIDENT_REPORTER,
  INCIDENT_CAP,
  NEUTRAL,
} from "./compute";
import { makeGraph, type Entity, type Signal, type TrustGraph } from "./model";
import type { Address } from "chainsage";

// --- fixtures -------------------------------------------------------------

const addr = (n: string) => (`0x${n.repeat(40).slice(0, 40)}` as Address);
const A = addr("a");
const B = addr("b");
const C = addr("c");
const D = addr("d");
const XA = addr("1");
const XB = addr("2");
const XC = addr("3");
const XD = addr("4");
const Z = addr("e");

const ent = (id: Address, kind: Entity["kind"] = "contract"): Entity => ({ id, kind, firstSeen: 0 });
const att = (from: Address, about: Address, value = 1, weight = 2): Signal => ({
  from,
  about,
  type: "attestation",
  weight,
  value,
  at: 0,
});

/**
 * A chain  Xa–A–B–C–Xc  with B–Xb, so C, B, A have equal high baselines and A is
 * two hops from C. D (+Xd) is a separate component. This is the canonical
 * topology for the incident-decay test.
 */
function chainGraph(): TrustGraph {
  const entities = [A, B, C, D, XA, XB, XC, XD].map((a) => ent(a));
  const signals: Signal[] = [
    att(XA, A), // baseline for A  (edge Xa–A)
    att(XB, B), // baseline for B  (edge Xb–B)
    att(XC, C), // baseline for C  (edge Xc–C)
    att(A, B), // chain edge A–B (also baseline for B)
    att(B, C), // chain edge B–C (also baseline for C)
    att(XD, D), // D's own component
  ];
  return makeGraph(entities, signals);
}

/** Stable serialization of the score map for deep comparison. */
function snapshot(scores: Map<string, { score: number; confidence: number; contributors: number }>) {
  return [...scores.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.score}:${v.confidence}:${v.contributors}`)
    .join("|");
}

const scoreOf = (m: Map<string, { score: number }>, a: Address) => m.get(a.toLowerCase())!.score;

// =====================================================================
// 1. Determinism + order-independence
// =====================================================================

describe("determinism", () => {
  it("same graph → identical scores, every time", () => {
    const g = chainGraph();
    const first = snapshot(computeAllTrust(g));
    for (let i = 0; i < 25; i++) {
      expect(snapshot(computeAllTrust(g))).toBe(first);
    }
  });

  it("scores are independent of signal ordering", () => {
    const g = chainGraph();
    const reversed = makeGraph(g.entities, [...g.signals].reverse());
    const shuffled = makeGraph(g.entities, [g.signals[3], g.signals[0], g.signals[5], g.signals[1], g.signals[4], g.signals[2]]);
    const base = snapshot(computeAllTrust(g));
    expect(snapshot(computeAllTrust(reversed))).toBe(base);
    expect(snapshot(computeAllTrust(shuffled))).toBe(base);
  });
});

// =====================================================================
// 2. Bounded propagation
// =====================================================================

describe("bounded propagation", () => {
  it("every score and confidence stays within [0,1]", () => {
    const scores = computeAllTrust(chainGraph());
    for (const s of scores.values()) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(1);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("a strongly positive clique never exceeds 1 (no runaway)", () => {
    const nodes = [A, B, C];
    const signals: Signal[] = [];
    // everyone attests everyone, max positive, heavy weight
    for (const f of nodes) for (const a of nodes) if (f !== a) signals.push(att(f, a, 1, 100));
    const scores = computeAllTrust(makeGraph(nodes.map((n) => ent(n)), signals));
    for (const s of scores.values()) expect(s.score).toBeLessThanOrEqual(1);
  });

  it("converges — extra iterations barely move the result", () => {
    const g = chainGraph();
    const a12 = scoreOf(computeAllTrust(g, { iterations: 12 }), C);
    const a40 = scoreOf(computeAllTrust(g, { iterations: 40 }), C);
    expect(Math.abs(a12 - a40)).toBeLessThan(1e-3);
  });

  it("an entity with no signals is neutral with zero confidence", () => {
    const g = makeGraph([ent(Z, "agent")], []);
    const s = computeTrust(Z, g);
    expect(s.score).toBeCloseTo(NEUTRAL, 6);
    expect(s.confidence).toBe(0);
    expect(s.contributors).toBe(0);
  });
});

// =====================================================================
// 3. Incident decay — the signature feature
// =====================================================================

describe("incident propagation", () => {
  it("collapses the incident node, drags neighbours with distance decay, leaves isolated nodes untouched", () => {
    const g = chainGraph();
    const pre = computeAllTrust(g);
    const post = computeAllTrust(reportIncident(C, g, { at: 1 }));

    // (a) the incident node collapses
    expect(scoreOf(post, C)).toBeLessThanOrEqual(INCIDENT_CAP);
    expect(scoreOf(post, C)).toBeLessThan(scoreOf(pre, C));

    // (b) the direct neighbour B is downgraded
    expect(scoreOf(post, B)).toBeLessThan(scoreOf(pre, B));

    // (c) the distant node A is downgraded LESS than B (decay with distance)
    const dropB = scoreOf(pre, B) - scoreOf(post, B);
    const dropA = scoreOf(pre, A) - scoreOf(post, A);
    expect(dropA).toBeGreaterThan(0); // still affected…
    expect(dropB).toBeGreaterThan(dropA); // …but less than the direct neighbour
    expect(scoreOf(post, A)).toBeGreaterThan(scoreOf(post, B));

    // (d) the unconnected component (D) is completely untouched
    expect(scoreOf(post, D)).toBeCloseTo(scoreOf(pre, D), 6);
  });

  it("the incident is attributed to the reporter sentinel, not the entity (self-cap would mute it)", () => {
    const g = chainGraph();
    const incidented = reportIncident(C, g);
    const injected = incidented.signals[incidented.signals.length - 1];
    expect(injected.from.toLowerCase()).toBe(INCIDENT_REPORTER.toLowerCase());
    expect(injected.about).toBe(C);
    expect(injected.type).toBe("incident");
    expect(injected.value).toBeLessThan(0);
  });

  it("an incident node cannot be rehabilitated by trusted neighbours", () => {
    // C surrounded by maximally-trusted neighbours, then incident reported.
    const nodes = [C, A, B];
    const signals = [att(A, C, 1, 50), att(B, C, 1, 50), att(XA, A, 1, 50), att(XB, B, 1, 50)];
    const post = computeAllTrust(reportIncident(C, makeGraph(nodes.concat([XA, XB]).map((n) => ent(n)), signals)));
    expect(scoreOf(post, C)).toBeLessThanOrEqual(INCIDENT_CAP);
  });
});

// =====================================================================
// 4. Confidence scaling
// =====================================================================

describe("confidence scaling", () => {
  it("more independent contributors → higher confidence", () => {
    const one = computeTrust(C, makeGraph([ent(C)], [att(XA, C)]));
    const three = computeTrust(
      C,
      makeGraph([ent(C)], [att(XA, C), att(XB, C), att(XC, C)])
    );
    expect(three.contributors).toBe(3);
    expect(one.contributors).toBe(1);
    expect(three.confidence).toBeGreaterThan(one.confidence);
  });

  it("self-signals do not count as contributors", () => {
    const s = computeTrust(C, makeGraph([ent(C)], [att(C, C), att(C, C)]));
    expect(s.contributors).toBe(0);
    expect(s.confidence).toBe(0);
  });
});

// =====================================================================
// 5. Self-attestation cap (anti-gaming, partial — see README)
// =====================================================================

describe("self-attestation cap", () => {
  it("flooding self-attestations cannot push trust high", () => {
    const flood: Signal[] = [];
    for (let i = 0; i < 20; i++) flood.push(att(Z, Z, 1, 10));
    const selfOnly = computeTrust(Z, makeGraph([ent(Z)], flood));
    // capped + neutral prior keep it near neutral, never near 1
    expect(selfOnly.score).toBeLessThan(0.6);
    expect(selfOnly.confidence).toBe(0);

    // a single genuine external attestation moves the score more than 20 self ones
    const external = computeTrust(Z, makeGraph([ent(Z)], [att(XA, Z, 1, 2)]));
    expect(external.score).toBeGreaterThan(selfOnly.score);
    expect(external.contributors).toBe(1);
  });
});

// =====================================================================
// 6. Purity
// =====================================================================

describe("purity", () => {
  it("reportIncident does not mutate the input graph", () => {
    const g = chainGraph();
    const before = g.signals.length;
    const after = reportIncident(C, g);
    expect(g.signals.length).toBe(before); // original untouched
    expect(after.signals.length).toBe(before + 1);
    expect(after).not.toBe(g);
  });
});
