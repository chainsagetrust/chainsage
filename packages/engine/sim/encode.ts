/**
 * sim/encode — turn a normalized SimAction into the read-only transaction we
 * simulate. We encode the SAME calldata a wallet would sign (approve / transfer),
 * so the simulation reflects exactly what the user is about to authorize.
 *
 * DEFENSIVE ONLY: this produces a transaction *description* for eth_call /
 * debug_traceCall / Tenderly to execute against a forked/pending state. It is
 * never signed, never broadcast, and moves no funds.
 */
import { encodeFunctionData, parseAbi } from "viem";
import type { SimAction, SimTxRequest } from "./types";

const ERC20_WRITE_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

/** Build the unsigned transaction request for an action. value is always 0n
 * (approve/transfer move ERC-20s, not native ETH). */
export function buildSimTx(action: SimAction): SimTxRequest {
  if (action.kind === "approve") {
    return {
      from: action.owner,
      to: action.token,
      data: encodeFunctionData({
        abi: ERC20_WRITE_ABI,
        functionName: "approve",
        args: [action.spender, action.rawAmount],
      }),
      value: 0n,
    };
  }
  return {
    from: action.owner,
    to: action.token,
    data: encodeFunctionData({
      abi: ERC20_WRITE_ABI,
      functionName: "transfer",
      args: [action.to, action.rawAmount],
    }),
    value: 0n,
  };
}
