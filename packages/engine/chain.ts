/**
 * ChainSage — on-chain core. Every number ChainSage renders or returns is read
 * here, LIVE, from Base mainnet. No mock data, ever.
 *
 *  - publicClient: a viem read-only client on Base.
 *  - getNativeBalance / getTokenBalance: balances.
 *  - scanApprovals: the heart — pulls live ERC-20 Approval logs for an owner,
 *    re-reads each allowance on-chain (never stale), flags unlimited ones.
 *  - getContractAgeDays: bounds a spender's contract age via bytecode sampling —
 *    a freshly deployed spender is the strongest drainer signal.
 *  - getCode: exposed for the Risk API's classify/simulate paths (EOA vs contract).
 */

import {
  createPublicClient,
  http,
  getAddress,
  parseAbiItem,
  formatUnits,
  type Address,
  type Log,
} from "viem";
import { base } from "viem/chains";

/**
 * RPC endpoint, resolved server-side first.
 *  - BASE_RPC_URL ............ secret, server-only (Risk API). Never NEXT_PUBLIC.
 *  - NEXT_PUBLIC_BASE_RPC_URL  client-exposed fallback (Guardian browser app).
 *  - public default .......... works but rate-limits aggressively.
 */
export const RPC_URL =
  process.env.BASE_RPC_URL ??
  process.env.NEXT_PUBLIC_BASE_RPC_URL ??
  "https://mainnet.base.org";

export const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

export const MAX_UINT256 = (1n << 256n) - 1n;
/** Treat any allowance ≥ half of max-uint as "unlimited" (covers common max patterns). */
export const UNLIMITED_THRESHOLD = MAX_UINT256 / 2n;

// ~2s/block on Base. 1.3M blocks ≈ 30 days. We try this first, then fall back.
export const APPROX_BLOCKS_PER_DAY = 43_200n; // 86400s / 2s
const FULL_WINDOW = 1_300_000n;
// Progressive fallbacks if the RPC caps getLogs range.
const FALLBACK_WINDOWS = [500_000n, 100_000n, 20_000n, 5_000n];

// --- ABI fragments --------------------------------------------------------

const ERC20_ABI = [
  parseAbiItem("function balanceOf(address) view returns (uint256)"),
  parseAbiItem("function decimals() view returns (uint8)"),
  parseAbiItem("function symbol() view returns (string)"),
  parseAbiItem("function name() view returns (string)"),
  parseAbiItem(
    "function allowance(address owner, address spender) view returns (uint256)"
  ),
] as const;

const APPROVAL_EVENT = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
);

// --- Known Base mainnet tokens (saves RPC calls for symbol/decimals) ------

export interface TokenMeta {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export const KNOWN_TOKENS: Record<string, TokenMeta> = {
  USDC: {
    address: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  WETH: {
    address: getAddress("0x4200000000000000000000000000000000000006"),
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
  },
  DAI: {
    address: getAddress("0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"),
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
  },
  USDbC: {
    address: getAddress("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"),
    symbol: "USDbC",
    name: "USD Base Coin",
    decimals: 6,
  },
  cbETH: {
    address: getAddress("0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"),
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    decimals: 18,
  },
};

const KNOWN_BY_ADDRESS = new Map<string, TokenMeta>(
  Object.values(KNOWN_TOKENS).map((t) => [t.address.toLowerCase(), t])
);

/**
 * A small allowlist of well-known, established Base spenders (routers, permit2).
 * A hit here is a positive "known-good" signal for the classify endpoint. This is
 * a heuristic convenience, NOT an endorsement — addresses are lowercased.
 */
export const KNOWN_GOOD_SPENDERS: Record<string, string> = {
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Uniswap Permit2",
  "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap V3 SwapRouter02 (Base)",
  "0x6ff5693b99212da76ad316178a184ab56d299b43": "Uniswap Universal Router (Base)",
};

/** True if `addr` is on the curated known-good spender allowlist. */
export function knownGoodSpender(addr: Address): string | null {
  return KNOWN_GOOD_SPENDERS[addr.toLowerCase()] ?? null;
}

// --- balances -------------------------------------------------------------

export interface NativeBalance {
  raw: bigint;
  formatted: string;
  symbol: "ETH";
}

export async function getNativeBalance(addr: Address): Promise<NativeBalance> {
  const raw = await publicClient.getBalance({ address: addr });
  return { raw, formatted: formatUnits(raw, 18), symbol: "ETH" };
}

export interface TokenBalance {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  raw: bigint;
  formatted: string;
}

/** Resolve a token's metadata, preferring the KNOWN_TOKENS map to save calls. */
async function resolveTokenMeta(token: Address): Promise<TokenMeta> {
  const known = KNOWN_BY_ADDRESS.get(token.toLowerCase());
  if (known) return known;
  const [symbol, decimals, name] = await Promise.all([
    publicClient
      .readContract({ address: token, abi: ERC20_ABI, functionName: "symbol" })
      .catch(() => "???"),
    publicClient
      .readContract({ address: token, abi: ERC20_ABI, functionName: "decimals" })
      .catch(() => 18),
    publicClient
      .readContract({ address: token, abi: ERC20_ABI, functionName: "name" })
      .catch(() => "Unknown Token"),
  ]);
  return {
    address: token,
    symbol: symbol as string,
    name: name as string,
    decimals: Number(decimals),
  };
}

/** Public wrapper around resolveTokenMeta for the API (best-effort token info). */
export async function getTokenMeta(token: Address): Promise<TokenMeta> {
  return resolveTokenMeta(token);
}

export async function getTokenBalance(
  token: Address,
  owner: Address
): Promise<TokenBalance> {
  const meta = await resolveTokenMeta(token);
  const raw = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
  return {
    token,
    symbol: meta.symbol,
    name: meta.name,
    decimals: meta.decimals,
    raw,
    formatted: formatUnits(raw, meta.decimals),
  };
}

/** Read the current on-chain allowance for a specific (token, owner, spender). */
export async function getAllowance(
  token: Address,
  owner: Address,
  spender: Address
): Promise<bigint> {
  return (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
}

/** Read balances for the seeded KNOWN_TOKENS list (cheap, fixed call count). */
export async function getKnownTokenBalances(
  owner: Address
): Promise<TokenBalance[]> {
  const results = await Promise.all(
    Object.values(KNOWN_TOKENS).map((t) =>
      getTokenBalance(t.address, owner).catch(() => null)
    )
  );
  return results.filter((b): b is TokenBalance => b !== null && b.raw > 0n);
}

// --- approval scan (the heart) -------------------------------------------

export interface LiveApproval {
  token: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  spender: Address;
  allowance: bigint;
  allowanceFormatted: string;
  isUnlimited: boolean;
  lastBlock: bigint;
}

type ApprovalLog = Log<bigint, number, false, typeof APPROVAL_EVENT, true>;

/**
 * Pull Approval logs for `owner` over a bounded recent window. If the RPC caps
 * the block range (a common public-RPC behaviour), we automatically retry with
 * progressively smaller windows instead of failing.
 */
async function fetchApprovalLogs(owner: Address): Promise<{
  logs: ApprovalLog[];
  windowBlocks: bigint;
}> {
  const latest = await publicClient.getBlockNumber();
  const windows = [FULL_WINDOW, ...FALLBACK_WINDOWS];

  let lastErr: unknown;
  for (const win of windows) {
    const fromBlock = latest > win ? latest - win : 0n;
    try {
      const logs = (await publicClient.getLogs({
        event: APPROVAL_EVENT,
        args: { owner },
        fromBlock,
        toBlock: latest,
      })) as ApprovalLog[];
      return { logs, windowBlocks: latest - fromBlock };
    } catch (err) {
      // RPC likely rejected the range; shrink and retry.
      lastErr = err;
      continue;
    }
  }
  throw lastErr ?? new Error("Failed to fetch approval logs");
}

/**
 * Scan all live ERC-20 approvals granted by `owner`.
 *
 * 1. Pull Approval(owner, spender, value) logs over the recent window.
 * 2. Dedupe to the latest log per (token, spender).
 * 3. RE-READ allowance(owner, spender) on-chain so values are never stale.
 * 4. Drop zero/revoked allowances; flag unlimited; sort unlimited-first then recent.
 */
export async function scanApprovals(owner: Address): Promise<LiveApproval[]> {
  const { logs } = await fetchApprovalLogs(owner);

  // Dedupe: keep the most recent log per (token, spender).
  const latestByPair = new Map<string, ApprovalLog>();
  for (const log of logs) {
    const token = log.address;
    const spender = log.args.spender;
    if (!spender) continue;
    const key = `${token.toLowerCase()}:${spender.toLowerCase()}`;
    const prev = latestByPair.get(key);
    if (!prev || (log.blockNumber ?? 0n) > (prev.blockNumber ?? 0n)) {
      latestByPair.set(key, log);
    }
  }

  // Re-read the CURRENT allowance for each pair and resolve token metadata.
  const pairs = [...latestByPair.values()];
  const resolved = await Promise.all(
    pairs.map(async (log) => {
      const token = getAddress(log.address);
      const spender = getAddress(log.args.spender as Address);
      try {
        const [allowance, meta] = await Promise.all([
          publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [owner, spender],
          }) as Promise<bigint>,
          resolveTokenMeta(token),
        ]);
        if (allowance === 0n) return null; // revoked / spent — not live anymore
        const approval: LiveApproval = {
          token,
          tokenSymbol: meta.symbol,
          tokenDecimals: meta.decimals,
          spender,
          allowance,
          allowanceFormatted: formatUnits(allowance, meta.decimals),
          isUnlimited: allowance >= UNLIMITED_THRESHOLD,
          lastBlock: log.blockNumber ?? 0n,
        };
        return approval;
      } catch {
        return null;
      }
    })
  );

  const live = resolved.filter((a): a is LiveApproval => a !== null);

  // Sort: unlimited first, then most recent.
  live.sort((a, b) => {
    if (a.isUnlimited !== b.isUnlimited) return a.isUnlimited ? -1 : 1;
    return Number(b.lastBlock - a.lastBlock);
  });

  return live;
}

// --- contract identity & age (drainer signal) ----------------------------

/** True if `addr` has deployed bytecode (a contract); false for an EOA. */
export async function isContract(addr: Address): Promise<boolean> {
  const code = await publicClient.getCode({ address: addr });
  return !!code && code !== "0x";
}

/**
 * Estimate a spender contract's age in days by sampling bytecode at a few past
 * blocks. Returns null for EOAs (no code) — they can't be "fresh contracts".
 *
 * We probe ~1d, ~6d, and ~30d ago. If code is ABSENT at a probe but PRESENT now,
 * the contract is younger than that probe's age — so we return the TIGHTEST upper
 * bound we can prove. This keeps us within public-RPC archive limits.
 *
 * NOTE: with a paid/archive RPC, upgrade this to an exact binary search for the
 * first block at which getBytecode returns code (the true deployment block).
 */
export async function getContractAgeDays(
  spender: Address
): Promise<number | null> {
  const codeNow = await publicClient.getCode({ address: spender });
  if (!codeNow || codeNow === "0x") return null; // EOA — skip

  const latest = await publicClient.getBlockNumber();
  // Probe ages in days, ascending, so the first "no code" gives the tightest bound.
  const probeDays = [1, 6, 30];

  for (const days of probeDays) {
    const back = BigInt(days) * APPROX_BLOCKS_PER_DAY;
    if (latest <= back) {
      // Chain isn't even this old here; can't probe further back.
      return days;
    }
    const probeBlock = latest - back;
    try {
      const code = await publicClient.getCode({
        address: spender,
        blockNumber: probeBlock,
      });
      if (!code || code === "0x") {
        // No code `days` ago, but code now ⇒ younger than `days`.
        return days;
      }
      // Code existed `days` ago — at least this old; keep probing further back.
    } catch {
      // RPC can't serve this historical block (no archive). Best effort: we know
      // it existed at the previous (more recent) probe, so we cannot tighten the
      // bound further — treat as at least the previous probe age (not fresh).
      return days;
    }
  }

  // Code present at the oldest probe (~30d) — established, definitely not fresh.
  return 30;
}
