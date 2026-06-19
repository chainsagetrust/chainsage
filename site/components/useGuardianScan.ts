"use client";

/**
 * useGuardianScan — orchestrates the live on-chain reads into a verdict Report,
 * exposing the staged scanning state machine that drives the animated UI.
 *
 * Stages (in order):
 *   idle → balances → approvals → ages → verdict → done | error
 *
 * Every value flows from lib/chain.ts (live Base reads) into lib/risk.ts (pure
 * verdict engine). Nothing here is mocked.
 */
import { useCallback, useRef, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import {
  getNativeBalance,
  getKnownTokenBalances,
  scanApprovals,
  getContractAgeDays,
  type LiveApproval,
  type TokenBalance,
  type NativeBalance,
} from "@/lib/chain";
import {
  buildReport,
  type Report,
  type ApprovalInput,
  type BalanceInput,
  type FreshSpenderInput,
} from "@/lib/risk";

export type ScanStage =
  | "idle"
  | "balances"
  | "approvals"
  | "ages"
  | "verdict"
  | "done"
  | "error";

export const STAGE_LABELS: Record<ScanStage, string> = {
  idle: "Ready",
  balances: "Reading balances",
  approvals: "Scanning token approvals",
  ages: "Checking contract ages",
  verdict: "Rendering verdict",
  done: "Complete",
  error: "Scan failed",
};

export interface ScanResult {
  address: Address;
  native: NativeBalance;
  tokenBalances: TokenBalance[];
  approvals: LiveApproval[];
  report: Report;
}

export interface GuardianScanState {
  stage: ScanStage;
  result: ScanResult | null;
  error: string | null;
  scan: (raw: string) => Promise<void>;
  reset: () => void;
}

const FRESH_THRESHOLD_DAYS = 7;

export function useGuardianScan(): GuardianScanState {
  const [stage, setStage] = useState<ScanStage>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setStage("idle");
    setResult(null);
    setError(null);
  }, []);

  const scan = useCallback(async (raw: string) => {
    const id = ++runId.current;
    setError(null);
    setResult(null);

    if (!raw || !isAddress(raw)) {
      setStage("error");
      setError("That doesn't look like a valid 0x wallet address. Check it and try again.");
      return;
    }
    const address = getAddress(raw);

    try {
      // --- stage 1: balances ---
      setStage("balances");
      const [native, tokenBalances] = await Promise.all([
        getNativeBalance(address),
        getKnownTokenBalances(address),
      ]);
      if (id !== runId.current) return;

      // --- stage 2: approvals ---
      setStage("approvals");
      const approvals = await scanApprovals(address);
      if (id !== runId.current) return;

      // --- stage 3: contract ages (only for distinct spenders) ---
      setStage("ages");
      const uniqueSpenders = [...new Set(approvals.map((a) => a.spender))] as Address[];
      const ages = await Promise.all(
        uniqueSpenders.map(async (s) => ({
          spender: s,
          ageDays: await getContractAgeDays(s).catch(() => null),
        }))
      );
      if (id !== runId.current) return;

      const freshSpenders: FreshSpenderInput[] = ages
        .filter((a): a is { spender: Address; ageDays: number } => a.ageDays !== null)
        .map((a) => ({ spender: a.spender, ageDays: a.ageDays }));

      // --- stage 4: verdict (pure) ---
      setStage("verdict");
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
      if (id !== runId.current) return;

      setResult({ address, native, tokenBalances, approvals, report });
      setStage("done");
    } catch (err) {
      if (id !== runId.current) return;
      setStage("error");
      const msg =
        err instanceof Error ? err.message : "Unknown error while reading the chain.";
      // Surface a friendly, product-voice hint for the common rate-limit case.
      const rateLimited = /rate|limit|429|timeout|exceeded|too many/i.test(msg);
      setError(
        rateLimited
          ? "The public Base RPC throttled this scan. Wait a moment and try again — or add your own RPC key (Alchemy/Infura/QuickNode) for fast, reliable scans."
          : msg
      );
    }
  }, []);

  return { stage, result, error, scan, reset };
}
