/**
 * sim/rpc — the self-hosted-RPC fallback providers, capability-detected.
 *
 *   rpc-trace  : if BASE_RPC_URL supports debug_traceCall, trace the call with the
 *                callTracer (withLog) and reconstruct every transfer/approval from
 *                the trace. Nearly as complete as Tenderly, no third party.
 *   rpc-call   : DEGRADED last resort. Plain eth_call can only tell us whether the
 *                tx reverts — it returns no asset changes. So this provider reports
 *                effectsObserved:false (simulated stays false) and surfaces revert
 *                only. Honest about how little it catches.
 *
 * Capability is DETECTED, never assumed: we probe debug_traceCall once per RPC URL
 * (QuickNode/Alchemy/public differ) and cache the result.
 */
import { getAddress, type Address } from "viem";
import { RPC_URL, publicClient } from "../chain";
import { parseTraceResult } from "./parse";
import type { ProviderResult, SimProviderImpl, SimTxRequest } from "./types";

// Cache the debug_traceCall capability per RPC URL (probe is a network round-trip).
const traceSupport = new Map<string, Promise<boolean>>();

/** Probe whether the configured RPC exposes debug_traceCall. Cached per URL. */
export function detectTraceSupport(): Promise<boolean> {
  const cached = traceSupport.get(RPC_URL);
  if (cached) return cached;
  const probe = (async () => {
    try {
      await publicClient.request({
        // A trivial, harmless trace. If the method is unsupported the RPC rejects
        // with -32601 (method not found) / "not available", which throws here.
        method: "debug_traceCall" as never,
        params: [
          { from: ZERO, to: ZERO, data: "0x", value: "0x0" },
          "latest",
          { tracer: "callTracer", tracerConfig: { withLog: true } },
        ] as never,
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      // A revert / execution error still means the METHOD exists → supported.
      // "method not found" (-32601) / "not available" / "unsupported" / "does not
      // exist" all mean the node does NOT expose debug_traceCall → unsupported.
      if (
        msg.includes("method not found") ||
        msg.includes("not available") ||
        msg.includes("unsupported") ||
        msg.includes("does not exist") ||
        msg.includes("-32601")
      ) {
        return false;
      }
      // Some nodes return an empty/zero-frame trace for the no-op probe without
      // error; others execute it fine. Anything that isn't an explicit
      // "unsupported method" we treat as supported.
      return true;
    }
  })();
  traceSupport.set(RPC_URL, probe);
  return probe;
}

/** Test-only: clear the cached capability probe. */
export function _resetTraceSupport(): void {
  traceSupport.clear();
}

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

/** True if an eth_call error is a genuine on-chain revert (vs. a transport fault). */
function isExecutionRevert(err: unknown): boolean {
  const name = err instanceof Error ? err.name : "";
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  // viem raises CallExecutionError/ContractFunctionExecutionError for reverts.
  if (name.includes("ExecutionError")) return true;
  if (/execution reverted|revert|out of gas|invalid opcode|insufficient funds|transfer amount exceeds/i.test(msg))
    return true;
  // Transport faults (unreachable RPC / timeout) are NOT reverts.
  return false;
}

export class RpcTraceProvider implements SimProviderImpl {
  readonly name = "rpc-trace" as const;

  async available(): Promise<boolean> {
    return detectTraceSupport();
  }

  async run(tx: SimTxRequest): Promise<ProviderResult | null> {
    if (!(await this.available())) return null;
    try {
      const trace = (await publicClient.request({
        method: "debug_traceCall" as never,
        params: [
          {
            from: (tx.from as Address).toLowerCase(),
            to: (tx.to as Address).toLowerCase(),
            data: tx.data,
            value: "0x0",
          },
          "latest",
          { tracer: "callTracer", tracerConfig: { withLog: true } },
        ] as never,
      })) as Parameters<typeof parseTraceResult>[0];
      const parsed = parseTraceResult(trace);
      return { parsed, effectsObserved: true };
    } catch {
      return null;
    }
  }
}

export class RpcCallProvider implements SimProviderImpl {
  readonly name = "rpc-call" as const;

  async available(): Promise<boolean> {
    return true; // eth_call is universally available
  }

  async run(tx: SimTxRequest): Promise<ProviderResult | null> {
    try {
      await publicClient.call({
        account: getAddress(tx.from),
        to: getAddress(tx.to),
        data: tx.data,
        value: tx.value,
      });
      // Did not revert — but eth_call yields NO asset changes, so we observed no
      // effects. effectsObserved:false keeps `simulated` honest (false).
      return { parsed: { transfers: [], approvals: [], reverted: false }, effectsObserved: false };
    } catch (err) {
      // Distinguish a genuine on-chain REVERT (a real finding) from a transport
      // failure (RPC unreachable/timeout) — the latter means we could NOT run,
      // so we fall through to `none` rather than falsely reporting a revert.
      if (isExecutionRevert(err)) {
        return {
          parsed: {
            transfers: [],
            approvals: [],
            reverted: true,
            revertReason: err instanceof Error ? err.message : String(err),
          },
          effectsObserved: false,
        };
      }
      return null;
    }
  }
}
