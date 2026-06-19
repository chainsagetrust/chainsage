/**
 * /api/signals — the signal ingestion write-path (Deliverable C).
 *
 *   GET  → { ok, data: { signals } }                     read the ingested ledger
 *   POST → ingest a signal and persist it. Two body shapes:
 *     1. { signal: Signal }                              a raw network signal
 *     2. { verdict: Verdict, observer, outcome? }        a Phase 1–4 verdict outcome,
 *                                                        mapped via verdictToSignal()
 *
 * This is exactly how a verdict from Guardian / the SDK / the policy engine
 * becomes a Signal in the network. Real signal VOLUME requires real usage — this
 * route is the plumbing, not a claim of scale.
 */
import { verdictToSignal, type Signal, type Address, type ObservedOutcome } from "@chainsage/trust-network";
import type { Verdict } from "chainsage";
import { readSignals, appendSignal } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isAddr = (v: unknown): v is Address => typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);

export async function GET(): Promise<Response> {
  const signals = await readSignals();
  return json({ ok: true, data: { signals, count: signals.length } });
}

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: { message: "Body must be JSON." } }, 400);
  }

  let signal: Signal | null = null;

  if (body.verdict) {
    // Bridge from Phases 1–4: a Verdict + observed outcome → a Signal.
    const observer = body.observer;
    if (!isAddr(observer)) return json({ ok: false, error: { message: "`observer` must be a 0x address." } }, 400);
    const outcome = (body.outcome as ObservedOutcome) ?? "unknown";
    try {
      signal = verdictToSignal(body.verdict as Verdict, observer, outcome, Date.now());
    } catch {
      return json({ ok: false, error: { message: "Invalid verdict payload." } }, 400);
    }
  } else {
    const s = (body.signal ?? body) as Partial<Signal>;
    if (!isAddr(s.from) || !isAddr(s.about)) {
      return json({ ok: false, error: { message: "`from` and `about` must be 0x addresses." } }, 400);
    }
    if (typeof s.value !== "number" || s.value < -1 || s.value > 1) {
      return json({ ok: false, error: { message: "`value` must be a number in [-1, 1]." } }, 400);
    }
    signal = {
      from: s.from,
      about: s.about,
      type: (s.type as Signal["type"]) ?? "attestation",
      value: s.value,
      weight: typeof s.weight === "number" && s.weight >= 0 ? s.weight : 1,
      at: Date.now(),
    };
  }

  const all = await appendSignal(signal);
  return json({ ok: true, data: { signal, count: all.length } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
