import { describe, it, expect } from "vitest";
import { scoreToVerdict, type Classification } from "@chainsage/engine";
import { ChainSage } from "./client";
import { ChainSageDenied, ChainSageReview, ChainSageError } from "./errors";
import { decisionToScore } from "./map";
import type { Address, Intent } from "./types";

// --- fixtures -------------------------------------------------------------

const addr = (c: string): Address => (`0x${c.repeat(40)}`) as Address;
const TOKEN = addr("a");
const SPENDER = addr("b");
const OWNER = addr("c");

const KNOWN_GOOD: Classification = {
  verdict: "ALLOW",
  isContract: true,
  ageDays: 400,
  isFresh: false,
  knownGood: "Uniswap Permit2",
  signals: ["Address has deployed bytecode (it is a contract).", "Known-good spender: Uniswap Permit2."],
};
const FRESH: Classification = {
  verdict: "REVIEW",
  isContract: true,
  ageDays: 1,
  isFresh: true,
  knownGood: null,
  signals: ["Address has deployed bytecode (it is a contract).", "Freshly deployed contract — under 7 days old."],
};
const ESTABLISHED: Classification = {
  verdict: "ALLOW",
  isContract: true,
  ageDays: 30,
  isFresh: false,
  knownGood: null,
  signals: ["Established contract (at least ~30d old)."],
};
const EOA: Classification = {
  verdict: "REVIEW",
  isContract: false,
  ageDays: null,
  isFresh: false,
  knownGood: null,
  signals: ["Externally owned account (EOA), not a contract."],
};

function okFetch(data: Classification): typeof fetch {
  return (async () => ({
    status: 200,
    json: async () => ({ ok: true, data }),
  })) as unknown as typeof fetch;
}
function notOkFetch(): typeof fetch {
  return (async () => ({
    status: 500,
    json: async () => ({ ok: false, error: { message: "boom" } }),
  })) as unknown as typeof fetch;
}
function throwingFetch(): typeof fetch {
  return (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
}
function abortingFetch(): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    })) as unknown as typeof fetch;
}

const approveUnlimited: Intent = {
  kind: "approve",
  chain: "base",
  token: TOKEN,
  spender: SPENDER,
  amount: "unlimited",
  owner: OWNER,
};

// --- THE FAIL-SAFE GUARANTEE (mandatory) ---------------------------------

describe("fail-safe: errors never yield ALLOW", () => {
  it("a thrown fetch → non-ALLOW (REVIEW by default), flagged failSafe", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: throwingFetch() });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).not.toBe("ALLOW");
    expect(v.decision).toBe("REVIEW");
    expect(v.failSafe).toBe(true);
    expect(v.score).toBeLessThan(75); // never in the ALLOW band
  });

  it("an API {ok:false} → non-ALLOW", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: notOkFetch() });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).not.toBe("ALLOW");
    expect(v.failSafe).toBe(true);
  });

  it("a timeout → non-ALLOW", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: abortingFetch(), timeoutMs: 40 });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).not.toBe("ALLOW");
    expect(v.failSafe).toBe(true);
    expect(v.reasons[0]).toMatch(/fail/i);
  });

  it("onError:\"DENY\" makes failures fail CLOSED", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: throwingFetch(), onError: "DENY" });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).toBe("DENY");
    expect(v.failSafe).toBe(true);
  });

  it("guard never executes when the check fails", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: throwingFetch(), onError: "DENY" });
    let ran = false;
    await expect(
      cs.guard(approveUnlimited, () => {
        ran = true;
        return "signed";
      })
    ).rejects.toBeInstanceOf(ChainSageDenied);
    expect(ran).toBe(false);
  });
});

// --- honesty: the SDK never fabricates a simulation it did not run ---------

describe("simulated is honest (SDK runs no effect simulation)", () => {
  it("a successful verdict reports simulated:false and lists effect checks in notChecked", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    const v = await cs.check(approveUnlimited);
    expect(v.simulated).toBe(false);
    expect(v.notChecked.join(" ")).toMatch(/honeypot|hidden-transfer|intent-mismatch/i);
  });

  it("a fail-safe verdict also reports simulated:false", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: throwingFetch() });
    const v = await cs.check(approveUnlimited);
    expect(v.failSafe).toBe(true);
    expect(v.simulated).toBe(false);
  });
});

// --- verdict mapping (proves ALLOW is reachable; not just always-blocking) -

describe("verdict mapping (api mode, injected facts)", () => {
  it("approve unlimited to a known-good spender → ALLOW (score 100)", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(KNOWN_GOOD) });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).toBe("ALLOW");
    expect(v.score).toBe(100);
    expect(v.failSafe).toBe(false);
  });

  it("approve unlimited to a freshly-deployed spender → DENY", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(FRESH) });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).toBe("DENY");
    expect(v.reasons.join(" ")).toMatch(/drainer/i);
  });

  it("approve LIMITED to a fresh spender → REVIEW (not DENY)", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(FRESH) });
    const v = await cs.check({ ...approveUnlimited, amount: 1000n });
    expect(v.decision).toBe("REVIEW");
  });

  it("transfer to the token's own contract → DENY", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    const v = await cs.check({
      kind: "transfer",
      chain: "base",
      token: TOKEN,
      to: TOKEN, // == token contract
      amount: 5n,
      owner: OWNER,
    });
    expect(v.decision).toBe("DENY");
  });

  it("approve unlimited to an EOA → REVIEW", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(EOA) });
    const v = await cs.check(approveUnlimited);
    expect(v.decision).toBe("REVIEW");
  });

  it("swap between two established tokens → ALLOW", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    const v = await cs.check({
      kind: "swap",
      chain: "base",
      tokenIn: TOKEN,
      tokenOut: SPENDER,
      amountIn: 500_000_000n,
      owner: OWNER,
    });
    expect(v.decision).toBe("ALLOW");
  });

  it("x402_pay is flagged experimental", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    const v = await cs.check({ kind: "x402_pay", chain: "base", to: SPENDER, amount: 1000n, owner: OWNER });
    expect(v.experimental).toBe(true);
    expect(v.notChecked.join(" ")).toMatch(/x402/i);
  });

  it("every verdict carries a unique id and echoes the intent", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    const v1 = await cs.check(approveUnlimited);
    const v2 = await cs.check(approveUnlimited);
    expect(v1.verdictId).toMatch(/^vrd_/);
    expect(v1.verdictId).not.toBe(v2.verdictId);
    expect(v1.intent).toEqual(approveUnlimited);
  });
});

// --- score/decision band invariant ---------------------------------------

describe("score never contradicts the decision", () => {
  it("decisionToScore lands in the band scoreToVerdict maps back to", () => {
    for (const d of ["ALLOW", "REVIEW", "DENY"] as const) {
      expect(scoreToVerdict(decisionToScore(d))).toBe(d);
      expect(scoreToVerdict(decisionToScore(d, true))).toBe(d);
    }
  });
});

// --- guard() behavior -----------------------------------------------------

describe("guard()", () => {
  it("ALLOW → runs execute and returns its value", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(KNOWN_GOOD) });
    const out = await cs.guard(approveUnlimited, () => "signed");
    expect(out).toBe("signed");
  });

  it("DENY → throws ChainSageDenied, execute never runs", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(FRESH) });
    let ran = false;
    await expect(
      cs.guard(approveUnlimited, () => {
        ran = true;
      })
    ).rejects.toBeInstanceOf(ChainSageDenied);
    expect(ran).toBe(false);
  });

  it("REVIEW → throws ChainSageReview by default", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(EOA) });
    await expect(cs.guard(approveUnlimited, () => "x")).rejects.toBeInstanceOf(ChainSageReview);
  });

  it("REVIEW + onReview:\"allow\" → proceeds", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(EOA) });
    const out = await cs.guard(approveUnlimited, () => "ok", { onReview: "allow" });
    expect(out).toBe("ok");
  });

  it("REVIEW + approver callback → proceeds when approver returns true", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(EOA) });
    const out = await cs.guard(approveUnlimited, () => "human-ok", {
      onReview: async (v) => v.decision === "REVIEW",
    });
    expect(out).toBe("human-ok");
  });
});

// --- validation throws (developer error, not a silent verdict) ------------

describe("validation", () => {
  it("unsupported chain throws ChainSageError", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    await expect(
      cs.check({ ...approveUnlimited, chain: "ethereum" as unknown as "base" })
    ).rejects.toBeInstanceOf(ChainSageError);
  });

  it("malformed address throws ChainSageError", async () => {
    const cs = new ChainSage({ mode: "api", fetchImpl: okFetch(ESTABLISHED) });
    await expect(
      cs.check({ ...approveUnlimited, spender: "0xnope" as Address })
    ).rejects.toBeInstanceOf(ChainSageError);
  });
});
