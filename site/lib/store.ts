/**
 * Signal store — the persistence behind the ingestion write-path (Deliverable C).
 *
 * Deliberately the SIMPLEST thing that works: a JSON file under `.data/`. Swap it
 * for SQLite/Upstash/Postgres in production — the interface is the only contract.
 * SERVER-ONLY (uses node:fs); never import this from a client component.
 *
 * Honest note: this stores whatever is posted. Real signal *authenticity* (who is
 * allowed to attest, proof the outcome actually happened on-chain) is unsolved
 * here and is named in the README.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Signal } from "@chainsage/trust-network";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "signals.json");

export async function readSignals(): Promise<Signal[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Signal[]) : [];
  } catch {
    return []; // no file yet, or unreadable → empty ledger
  }
}

export async function appendSignal(signal: Signal): Promise<Signal[]> {
  const all = await readSignals();
  all.push(signal);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
  return all;
}
