/**
 * Simulation-layer tests — fully deterministic and OFFLINE.
 *
 * The parsers (Tenderly JSON / trace tree → ParsedSim) and the intent comparison
 * (deriveEffects) are pure, so we exercise them against hand-built fixtures that
 * mirror real provider responses. The orchestrator (simulateEffects) is tested
 * with INJECTED providers — no network, no Tenderly key, no RPC.
 *
 * What this proves: a clean swap/approve parses clean; a known hidden-transfer /
 * over-approval / intent-mismatch / honeypot-shaped fixture is flagged exactly as
 * the combiner expects; a revert is surfaced; and error/timeout/no-provider →
 * simulated:false (never a fabricated clean sim).
 */
import { describe, it, expect } from "vitest";
import {
  encodeAbiParameters,
  keccak256,
  pad,
  parseAbiParameters,
  toHex,
  getAddress,
  type Address,
} from "viem";
import { MAX_UINT256 } from "./chain";
import {
  buildSimTx,
  decodeLogs,
  deriveEffects,
  parseTenderlySimulation,
  parseTraceResult,
  simulateEffects,
  type ParsedSim,
  type ProviderResult,
  type RawLog,
  type SimAction,
  type SimProviderImpl,
} from "./sim";

// --- address + log fixtures ----------------------------------------------

const A = (c: string): Address => getAddress(`0x${c.repeat(40)}`);
const OWNER = A("1");
const TOKEN = A("2");
const SPENDER = A("3");
const TO = A("4");
const ATTACKER = A("5");

const TRANSFER_T0 = keccak256(toHex("Transfer(address,address,uint256)"));
const APPROVAL_T0 = keccak256(toHex("Approval(address,address,uint256)"));
const UINT = parseAbiParameters("uint256");
const topicAddr = (a: Address) => pad(a, { size: 32 }) as `0x${string}`;

function transferLog(token: Address, from: Address, to: Address, amount: bigint): RawLog {
  return {
    address: token,
    topics: [TRANSFER_T0, topicAddr(from), topicAddr(to)],
    data: encodeAbiParameters(UINT, [amount]),
  };
}
function approvalLog(token: Address, owner: Address, spender: Address, amount: bigint): RawLog {
  return {
    address: token,
    topics: [APPROVAL_T0, topicAddr(owner), topicAddr(spender)],
    data: encodeAbiParameters(UINT, [amount]),
  };
}

// Tenderly-shaped response builder.
function tenderly(opts: {
  logs?: RawLog[];
  assetChanges?: unknown[];
  status?: boolean;
  error?: string;
}) {
  return {
    transaction: {
      status: opts.status ?? true,
      error_message: opts.error ?? "",
      transaction_info: {
        logs: (opts.logs ?? []).map((raw) => ({ raw })),
        asset_changes: opts.assetChanges ?? [],
      },
    },
  };
}

// debug_traceCall (callTracer, withLog) shaped builder.
function trace(opts: {
  logs?: RawLog[];
  calls?: unknown[];
  value?: string;
  error?: string;
  revertReason?: string;
}) {
  return {
    type: "CALL",
    from: OWNER.toLowerCase(),
    to: TOKEN.toLowerCase(),
    value: opts.value ?? "0x0",
    logs: opts.logs ?? [],
    calls: opts.calls ?? [],
    error: opts.error,
    revertReason: opts.revertReason,
  };
}

const approveAction = (rawAmount: bigint, unlimited = false): SimAction => ({
  kind: "approve",
  owner: OWNER,
  token: TOKEN,
  spender: SPENDER,
  rawAmount,
  unlimited,
});
const transferAction = (rawAmount: bigint, to: Address = TO): SimAction => ({
  kind: "transfer",
  owner: OWNER,
  token: TOKEN,
  to,
  rawAmount,
});

// --- encoding -------------------------------------------------------------

describe("buildSimTx", () => {
  it("encodes approve() calldata (selector 0x095ea7b3), value 0, to = token", () => {
    const tx = buildSimTx(approveAction(1000n));
    expect(tx.data.startsWith("0x095ea7b3")).toBe(true);
    expect(tx.to).toBe(TOKEN);
    expect(tx.from).toBe(OWNER);
    expect(tx.value).toBe(0n);
  });
  it("encodes transfer() calldata (selector 0xa9059cbb)", () => {
    const tx = buildSimTx(transferAction(5n));
    expect(tx.data.startsWith("0xa9059cbb")).toBe(true);
  });
});

// --- raw log decoding -----------------------------------------------------

describe("decodeLogs", () => {
  it("decodes Transfer and Approval, ignores unknown events", () => {
    const unknown: RawLog = { address: TOKEN, topics: [keccak256(toHex("Mystery()"))], data: "0x" };
    const { transfers, approvals } = decodeLogs([
      transferLog(TOKEN, OWNER, TO, 100n),
      approvalLog(TOKEN, OWNER, SPENDER, MAX_UINT256),
      unknown,
    ]);
    expect(transfers).toHaveLength(1);
    expect(approvals).toHaveLength(1);
    expect(transfers[0].from).toBe(OWNER);
    expect(transfers[0].to).toBe(TO);
    expect(transfers[0].amount).toBe(100n);
    expect(approvals[0].spender).toBe(SPENDER);
    expect(approvals[0].amount).toBe(MAX_UINT256);
  });
});

// --- Tenderly parsing -----------------------------------------------------

describe("parseTenderlySimulation", () => {
  it("parses a clean approve (one Approval, no transfers, no revert)", () => {
    const p = parseTenderlySimulation(tenderly({ logs: [approvalLog(TOKEN, OWNER, SPENDER, 1000n)] }));
    expect(p.reverted).toBe(false);
    expect(p.approvals).toHaveLength(1);
    expect(p.transfers).toHaveLength(0);
  });

  it("flags a revert when status:false", () => {
    const p = parseTenderlySimulation(tenderly({ status: false, error: "execution reverted: SELL_FAILED" }));
    expect(p.reverted).toBe(true);
    expect(p.revertReason).toMatch(/SELL_FAILED/);
  });

  it("captures native ETH movement from asset_changes", () => {
    const p = parseTenderlySimulation(
      tenderly({
        assetChanges: [
          {
            type: "Transfer",
            from: OWNER.toLowerCase(),
            to: ATTACKER.toLowerCase(),
            raw_amount: "1000000000000000000",
            token_info: { standard: "NativeCurrency" },
          },
        ],
      })
    );
    expect(p.transfers).toHaveLength(1);
    expect(p.transfers[0].native).toBe(true);
    expect(p.transfers[0].to).toBe(ATTACKER);
  });
});

// --- trace parsing --------------------------------------------------------

describe("parseTraceResult", () => {
  it("collects logs from nested calls and native value transfers", () => {
    const t = trace({
      logs: [approvalLog(TOKEN, OWNER, SPENDER, 1000n)],
      calls: [{ type: "CALL", from: OWNER.toLowerCase(), to: ATTACKER.toLowerCase(), value: "0xde0b6b3a7640000", logs: [], calls: [] }],
    });
    const p = parseTraceResult(t);
    expect(p.approvals).toHaveLength(1);
    expect(p.transfers.some((x) => x.native && x.to === ATTACKER)).toBe(true);
    expect(p.reverted).toBe(false);
  });

  it("marks reverted when the top frame has an error", () => {
    const p = parseTraceResult(trace({ error: "execution reverted", revertReason: "no" }));
    expect(p.reverted).toBe(true);
  });
});

// --- deriveEffects: the intent comparison (the lethal logic) --------------

describe("deriveEffects — approve", () => {
  it("clean approve to the stated spender → no effect flags", () => {
    const parsed: ParsedSim = { approvals: [{ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 1000n }], transfers: [], reverted: false };
    const d = deriveEffects(parsed, approveAction(1000n));
    expect(d.effects).toEqual({});
    expect(d.notChecked.join(" ")).toMatch(/honeypot/i);
  });

  it("approve that ALSO moves funds → hidden transfer", () => {
    const parsed: ParsedSim = {
      approvals: [{ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 1000n }],
      transfers: [{ token: TOKEN, from: OWNER, to: ATTACKER, amount: 7n }],
      reverted: false,
    };
    expect(deriveEffects(parsed, approveAction(1000n)).effects.hasHiddenTransfer).toBe(true);
  });

  it("approve to a DIFFERENT spender than declared → hidden transfer", () => {
    const parsed: ParsedSim = {
      approvals: [{ token: TOKEN, owner: OWNER, spender: ATTACKER, amount: 1000n }],
      transfers: [],
      reverted: false,
    };
    const d = deriveEffects(parsed, approveAction(1000n));
    expect(d.effects.hasHiddenTransfer).toBe(true);
  });

  it("over-approval (asked 1000, granted unlimited) → hidden transfer", () => {
    const parsed: ParsedSim = {
      approvals: [{ token: TOKEN, owner: OWNER, spender: SPENDER, amount: MAX_UINT256 }],
      transfers: [],
      reverted: false,
    };
    expect(deriveEffects(parsed, approveAction(1000n)).effects.hasHiddenTransfer).toBe(true);
  });

  it("requested unlimited, granted unlimited → clean (no over-approval)", () => {
    const parsed: ParsedSim = {
      approvals: [{ token: TOKEN, owner: OWNER, spender: SPENDER, amount: MAX_UINT256 }],
      transfers: [],
      reverted: false,
    };
    expect(deriveEffects(parsed, approveAction(MAX_UINT256, true)).effects).toEqual({});
  });

  it("declared approve never took effect → intent mismatch", () => {
    const parsed: ParsedSim = { approvals: [], transfers: [], reverted: false };
    expect(deriveEffects(parsed, approveAction(1000n)).effects.intentMismatch).toBe(true);
  });
});

describe("deriveEffects — transfer", () => {
  it("clean transfer to the stated recipient → no effect flags", () => {
    const parsed: ParsedSim = { transfers: [{ token: TOKEN, from: OWNER, to: TO, amount: 50n }], approvals: [], reverted: false };
    expect(deriveEffects(parsed, transferAction(50n)).effects).toEqual({});
  });

  it("funds also reach a stray address → hidden transfer", () => {
    const parsed: ParsedSim = {
      transfers: [
        { token: TOKEN, from: OWNER, to: TO, amount: 50n },
        { token: TOKEN, from: OWNER, to: ATTACKER, amount: 50n },
      ],
      approvals: [],
      reverted: false,
    };
    expect(deriveEffects(parsed, transferAction(50n)).effects.hasHiddenTransfer).toBe(true);
  });

  it("recipient receives materially less than declared (fee-on-transfer) → intent mismatch, not hidden", () => {
    const parsed: ParsedSim = { transfers: [{ token: TOKEN, from: OWNER, to: TO, amount: 50n }], approvals: [], reverted: false };
    const d = deriveEffects(parsed, transferAction(100n)); // asked 100, only 50 arrived
    expect(d.effects.intentMismatch).toBe(true);
    expect(d.effects.hasHiddenTransfer).toBeUndefined();
  });

  it("a 1% rounding difference is tolerated → clean", () => {
    const parsed: ParsedSim = { transfers: [{ token: TOKEN, from: OWNER, to: TO, amount: 1000n }], approvals: [], reverted: false };
    expect(deriveEffects(parsed, transferAction(1005n)).effects).toEqual({});
  });

  it("a revert asserts NO effects (nothing executed)", () => {
    const parsed: ParsedSim = { transfers: [], approvals: [], reverted: true, revertReason: "x" };
    expect(deriveEffects(parsed, transferAction(50n)).effects).toEqual({});
  });

  it("honeypot is never derived from a single approve/transfer sim", () => {
    const parsed: ParsedSim = { transfers: [{ token: TOKEN, from: OWNER, to: TO, amount: 50n }], approvals: [], reverted: false };
    expect(deriveEffects(parsed, transferAction(50n)).effects.isHoneypot).toBeUndefined();
  });
});

// --- orchestration: provider chain + fail-safe ----------------------------

function provider(
  name: SimProviderImpl["name"],
  result: ProviderResult | null,
  available = true
): SimProviderImpl {
  return { name, available: async () => available, run: async () => result };
}

const cleanApproveResult: ProviderResult = {
  parsed: { approvals: [{ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 1000n }], transfers: [], reverted: false },
  effectsObserved: true,
};
const hiddenResult: ProviderResult = {
  parsed: {
    approvals: [{ token: TOKEN, owner: OWNER, spender: SPENDER, amount: 1000n }],
    transfers: [{ token: TOKEN, from: OWNER, to: ATTACKER, amount: 9n }],
    reverted: false,
  },
  effectsObserved: true,
};

describe("simulateEffects — provider chain", () => {
  it("first available provider with real effects wins; simulated:true", async () => {
    const out = await simulateEffects(approveAction(1000n), {
      providers: [provider("tenderly", cleanApproveResult)],
    });
    expect(out.simulated).toBe(true);
    expect(out.provider).toBe("tenderly");
    expect(out.effects).toEqual({});
  });

  it("falls through an unavailable provider to the next", async () => {
    const out = await simulateEffects(approveAction(1000n), {
      providers: [provider("tenderly", null, false), provider("rpc-trace", hiddenResult)],
    });
    expect(out.provider).toBe("rpc-trace");
    expect(out.simulated).toBe(true);
    expect(out.effects.hasHiddenTransfer).toBe(true);
  });

  it("degraded eth_call (effectsObserved:false) → simulated:false, revert surfaced", async () => {
    const degraded: ProviderResult = {
      parsed: { transfers: [], approvals: [], reverted: true, revertReason: "boom" },
      effectsObserved: false,
    };
    const out = await simulateEffects(transferAction(5n), {
      providers: [provider("tenderly", null, false), provider("rpc-trace", null, false), provider("rpc-call", degraded)],
    });
    expect(out.provider).toBe("rpc-call");
    expect(out.simulated).toBe(false);
    expect(out.reverted).toBe(true);
    expect(out.notChecked.join(" ")).toMatch(/hidden|mismatch|honeypot/i);
  });

  it("NO provider can run → simulated:false, provider 'none', effects {} (never fabricated)", async () => {
    const out = await simulateEffects(approveAction(1000n), {
      providers: [provider("tenderly", null, false), provider("rpc-trace", null, false), provider("rpc-call", null, false)],
    });
    expect(out.simulated).toBe(false);
    expect(out.provider).toBe("none");
    expect(out.effects).toEqual({});
  });

  it("a provider error (run rejects) → falls through (never a fabricated clean sim)", async () => {
    const throwing: SimProviderImpl = {
      name: "tenderly",
      available: async () => true,
      run: async () => {
        throw new Error("provider down");
      },
    };
    const out = await simulateEffects(approveAction(1000n), { providers: [throwing] });
    expect(out.simulated).toBe(false);
    expect(out.provider).toBe("none");
  });

  it("a provider TIMEOUT → falls through to 'none' (treated as not-simulated, never ALLOW-clean)", async () => {
    const hanging: SimProviderImpl = {
      name: "tenderly",
      available: async () => true,
      run: () => new Promise<ProviderResult>(() => {}), // never resolves
    };
    const out = await simulateEffects(approveAction(1000n), { providers: [hanging], timeoutMs: 20 });
    expect(out.simulated).toBe(false);
    expect(out.provider).toBe("none");
  });
});
