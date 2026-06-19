/**
 * Seed graph for the visualization.
 *
 * REAL nodes (`real: true`) are genuine Base mainnet addresses — the same ones on
 * Guardian's known-good allowlist (Uniswap routers, Permit2) and the canonical
 * USDC/WETH tokens. They are labelled as real.
 *
 * SEED nodes (`real: false`) are fictional agents, wallets, and one fresh
 * "drainer" contract, added purely for demo DENSITY so the propagation is legible.
 * They are NOT live network participants and the README says so plainly.
 *
 * The signals below are likewise illustrative seeds. Real reputation requires
 * real verdict-outcome volume from real usage — see the README + Deliverable C.
 */
import { makeGraph, type Entity, type Signal, type TrustGraph, type Address } from "@chainsage/trust-network";

// --- REAL Base mainnet addresses ------------------------------------------
export const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
export const SWAP_ROUTER_02 = "0x2626664c2603336E57B271c5C0B26F421741e481" as Address;
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
export const WETH = "0x4200000000000000000000000000000000000006" as Address;

// --- SEED (fictional) addresses -------------------------------------------
export const AGENT_ALPHA = "0xA1000000000000000000000000000000000000A1" as Address;
export const AGENT_BETA = "0xB2000000000000000000000000000000000000B2" as Address;
export const WALLET_1 = "0x1100000000000000000000000000000000000011" as Address;
export const WALLET_2 = "0x2200000000000000000000000000000000000022" as Address;
export const VICTIM_WALLET = "0x5100000000000000000000000000000000000051" as Address;
export const DRAINER = "0xDEAD00000000000000000000000000000000DEAD" as Address;

export interface SeedNode extends Entity {
  x: number;
  y: number;
}

export const NODES: SeedNode[] = [
  // real protocols / tokens — central cluster
  { id: PERMIT2, kind: "protocol", firstSeen: 0, label: "Uniswap Permit2", real: true, x: 360, y: 300 },
  { id: UNIVERSAL_ROUTER, kind: "protocol", firstSeen: 0, label: "Universal Router", real: true, x: 520, y: 210 },
  { id: SWAP_ROUTER_02, kind: "protocol", firstSeen: 0, label: "SwapRouter02", real: true, x: 520, y: 390 },
  { id: USDC, kind: "contract", firstSeen: 0, label: "USDC", real: true, x: 200, y: 200 },
  { id: WETH, kind: "contract", firstSeen: 0, label: "WETH", real: true, x: 200, y: 410 },
  // seeded agents / wallets — right cluster
  { id: AGENT_ALPHA, kind: "agent", firstSeen: 0, label: "Agent Alpha", real: false, x: 700, y: 170 },
  { id: AGENT_BETA, kind: "agent", firstSeen: 0, label: "Agent Beta", real: false, x: 710, y: 330 },
  { id: WALLET_1, kind: "wallet", firstSeen: 0, label: "Wallet 1", real: false, x: 850, y: 230 },
  { id: WALLET_2, kind: "wallet", firstSeen: 0, label: "Wallet 2", real: false, x: 850, y: 410 },
  // seeded drainer subcluster — bottom
  { id: VICTIM_WALLET, kind: "wallet", firstSeen: 0, label: "Victim Wallet", real: false, x: 700, y: 500 },
  { id: DRAINER, kind: "contract", firstSeen: 0, label: "Fresh Contract (seed)", real: false, x: 540, y: 520 },
];

const a = (from: Address, about: Address, value: number, weight: number, type: Signal["type"] = "attestation"): Signal => ({
  from,
  about,
  type,
  value,
  weight,
  at: 0,
});

export const SIGNALS: Signal[] = [
  // agents report good outcomes using the real protocols
  a(AGENT_ALPHA, UNIVERSAL_ROUTER, 1, 3, "verdict_outcome"),
  a(AGENT_ALPHA, PERMIT2, 1, 2, "verdict_outcome"),
  a(AGENT_BETA, SWAP_ROUTER_02, 1, 3, "verdict_outcome"),
  a(AGENT_BETA, PERMIT2, 0.9, 2, "verdict_outcome"),
  // protocols compose with each other / the tokens
  a(UNIVERSAL_ROUTER, PERMIT2, 1, 2),
  a(SWAP_ROUTER_02, PERMIT2, 1, 2),
  a(UNIVERSAL_ROUTER, USDC, 0.9, 2, "verdict_outcome"),
  a(SWAP_ROUTER_02, WETH, 0.9, 2, "verdict_outcome"),
  a(AGENT_ALPHA, USDC, 1, 2, "verdict_outcome"),
  // wallets vouch for the agents they delegate to
  a(WALLET_1, AGENT_ALPHA, 1, 2),
  a(WALLET_2, AGENT_BETA, 1, 2),
  // the drainer subcluster — mild positives BEFORE the incident is known
  a(VICTIM_WALLET, DRAINER, 0.6, 2, "verdict_outcome"),
  a(WALLET_2, DRAINER, 0.4, 1, "verdict_outcome"),
  // victim links into the main network via Agent Beta
  a(VICTIM_WALLET, AGENT_BETA, 1, 1),
];

export const ENTITIES: Entity[] = NODES.map(({ x: _x, y: _y, ...e }) => e);

export const POSITIONS: Record<string, { x: number; y: number }> = Object.fromEntries(
  NODES.map((n) => [n.id.toLowerCase(), { x: n.x, y: n.y }])
);

/** Build the base seed graph, optionally merged with ingested signals from the store. */
export function buildGraph(extraSignals: Signal[] = []): TrustGraph {
  return makeGraph(ENTITIES, [...SIGNALS, ...extraSignals]);
}

export const VIEWBOX = { w: 980, h: 620 };
