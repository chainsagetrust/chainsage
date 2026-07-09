/**
 * score — wallet health + flags. This is the SAME scan path Guardian runs,
 * lifted out of its React hook into a plain async function: live balances →
 * live approvals (allowances re-read) → contract ages → buildReport(). The
 * verdict engine (buildReport) is the shared, tested @chainsage/engine — no copy.
 */
import { getAddress, type Address } from "viem";
import {
  publicClient,
  getNativeBalance,
  getKnownTokenBalances,
  scanApprovals,
  getContractAgeDays,
  buildReport,
  type Report,
  type ApprovalInput,
  type BalanceInput,
  type FreshSpenderInput,
} from "@chainsage/engine";

/** Matches Guardian's threshold so the API and the app agree. */
export const FRESH_THRESHOLD_DAYS = 7;

export interface ScoreMeta {
  scannedAt: string;
  /** Block height the scan was anchored to (string — JSON can't hold a bigint). */
  blockNumber: string;
  chain: "base";
}

export interface ScoreResult {
  /** The full WalletReport: healthScore, verdict, flags[], stats. */
  report: Report;
  meta: ScoreMeta;
}

export async function scoreAddress(addr: Address): Promise<ScoreResult> {
  const address = getAddress(addr);

  // stage 1: balances + anchor block (live)
  const [native, tokenBalances, blockNumber] = await Promise.all([
    getNativeBalance(address),
    getKnownTokenBalances(address),
    publicClient.getBlockNumber(),
  ]);

  // stage 2: live approvals (allowance re-read on-chain, never stale)
  const approvals = await scanApprovals(address);

  // stage 3: contract ages for the distinct spenders
  const uniqueSpenders = [...new Set(approvals.map((a) => a.spender))] as Address[];
  const ages = await Promise.all(
    uniqueSpenders.map(async (s) => ({
      spender: s,
      ageDays: await getContractAgeDays(s).catch(() => null),
    }))
  );
  const freshSpenders: FreshSpenderInput[] = ages
    .filter((a): a is { spender: Address; ageDays: number } => a.ageDays !== null)
    .map((a) => ({ spender: a.spender, ageDays: a.ageDays }));

  // stage 4: verdict (pure, shared engine)
  const approvalInputs: ApprovalInput[] = approvals.map((a) => ({
    token: a.token,
    tokenSymbol: a.tokenSymbol,
    spender: a.spender,
    allowance: a.allowance,
    isUnlimited: a.isUnlimited,
    lastBlock: a.lastBlock,
  }));
  const balanceInputs: BalanceInput[] = [
    { symbol: "ETH", amount: Number(native.formatted) },
    ...tokenBalances.map((t) => ({ symbol: t.symbol, amount: Number(t.formatted) })),
  ];

  const report = buildReport({
    approvals: approvalInputs,
    balances: balanceInputs,
    freshSpenders,
    freshThresholdDays: FRESH_THRESHOLD_DAYS,
  });

  return {
    report,
    meta: {
      scannedAt: new Date().toISOString(),
      blockNumber: blockNumber.toString(),
      chain: "base",
    },
  };
}
