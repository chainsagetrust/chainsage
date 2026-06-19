/**
 * EXPERIMENTAL — MCP tool wrapper.
 *
 * Exposes `chainsage.check` as a Model Context Protocol tool so agent frameworks
 * can call it as a tool before signing. This is intentionally thin and
 * dependency-free: it returns a plain tool descriptor `{ name, description,
 * inputSchema, handler }` you register with your MCP server of choice. It does
 * NOT bundle an MCP server SDK.
 *
 * Not covered by the SDK's stability guarantees yet — the shape may change.
 */
import { ChainSage } from "./client";
import type { Address, Intent, Verdict } from "./types";

export interface McpToolResult {
  /** MCP content blocks. */
  content: { type: "text"; text: string }[];
  isError?: boolean;
  /** The structured verdict, for callers that want more than text. */
  verdict?: Verdict;
}

export interface ChainSageMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

const INPUT_SCHEMA = {
  type: "object",
  required: ["kind", "chain", "owner"],
  properties: {
    kind: { type: "string", enum: ["approve", "transfer", "swap", "x402_pay"] },
    chain: { type: "string", enum: ["base"] },
    owner: { type: "string", description: "0x address initiating the action" },
    token: { type: "string", description: "ERC-20 token (approve/transfer)" },
    spender: { type: "string", description: "spender (approve)" },
    to: { type: "string", description: "recipient (transfer/x402_pay)" },
    tokenIn: { type: "string", description: "input token (swap)" },
    tokenOut: { type: "string", description: "output token (swap)" },
    amount: {
      type: "string",
      description: 'raw token amount as a string, or "unlimited" (approve)',
    },
    amountIn: { type: "string", description: "raw input amount as a string (swap)" },
  },
} as const;

function toAmount(v: unknown): bigint | "unlimited" {
  if (v === "unlimited" || v === "max") return "unlimited";
  if (typeof v === "string" || typeof v === "number") return BigInt(v);
  throw new Error(`invalid amount: ${String(v)}`);
}

/** Coerce loose JSON args (amounts as strings) into a typed Intent. */
function toIntent(a: Record<string, unknown>): Intent {
  const chain = "base" as const;
  const owner = a.owner as Address;
  switch (a.kind) {
    case "approve":
      return { kind: "approve", chain, owner, token: a.token as Address, spender: a.spender as Address, amount: toAmount(a.amount) };
    case "transfer":
      return { kind: "transfer", chain, owner, token: a.token as Address, to: a.to as Address, amount: toAmount(a.amount) as bigint };
    case "swap":
      return { kind: "swap", chain, owner, tokenIn: a.tokenIn as Address, tokenOut: a.tokenOut as Address, amountIn: toAmount(a.amountIn) as bigint };
    case "x402_pay":
      return { kind: "x402_pay", chain, owner, to: a.to as Address, amount: toAmount(a.amount) as bigint };
    default:
      throw new Error(`unknown intent kind: ${String(a.kind)}`);
  }
}

/**
 * Build the MCP tool descriptor. Pass a configured ChainSage instance, or one is
 * created with defaults (local mode).
 */
export function createChainSageMcpTool(cs: ChainSage = new ChainSage()): ChainSageMcpTool {
  return {
    name: "chainsage_check",
    description:
      "Get a ChainSage verdict (ALLOW / REVIEW / DENY) for a proposed on-chain intent BEFORE signing it. Fails safe to non-ALLOW if it cannot verify.",
    inputSchema: INPUT_SCHEMA as unknown as Record<string, unknown>,
    handler: async (args) => {
      try {
        const intent = toIntent(args);
        const verdict = await cs.check(intent);
        const summary = `${verdict.decision} (score ${verdict.score}) — ${verdict.reasons[0] ?? ""}`;
        return {
          content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(verdict, null, 2)}` }],
          isError: verdict.decision === "DENY",
          verdict,
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `chainsage_check failed: ${err instanceof Error ? err.message : String(err)}` },
          ],
          isError: true,
        };
      }
    },
  };
}
