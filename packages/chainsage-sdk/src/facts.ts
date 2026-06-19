/**
 * Facts layer — gather a `Classification` for an address, either by calling the
 * hosted Risk API (api mode) or running the shared engine in-process (local
 * mode). Both return the SAME shape, so the pure mappers in map.ts are
 * mode-agnostic. Any failure here throws ChainSageError, which check() converts
 * into a fail-safe (non-ALLOW) verdict.
 */
import { classifyAddress, type Classification } from "@chainsage/engine";
import type { Address, ChainSageConfig } from "./types";
import { ChainSageError } from "./errors";

export interface Facts {
  classify(address: Address): Promise<Classification>;
}

/** local mode — no network hop; runs the engine's reads directly. */
export class LocalFacts implements Facts {
  async classify(address: Address): Promise<Classification> {
    return classifyAddress(address);
  }
}

/** api mode — calls the Phase-2 Risk API /classify with a timeout. */
export class ApiFacts implements Facts {
  private readonly url: string;
  private readonly key: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: ChainSageConfig) {
    this.url = (cfg.apiUrl ?? "http://localhost:3001").replace(/\/$/, "");
    this.key = cfg.apiKey ?? "demo";
    this.timeoutMs = cfg.timeoutMs ?? 8000;
    const f = cfg.fetchImpl ?? globalThis.fetch;
    if (!f) {
      throw new ChainSageError(
        "No fetch implementation available. Pass `fetchImpl` in the config or run on a runtime with a global fetch."
      );
    }
    this.fetchImpl = f;
  }

  async classify(address: Address): Promise<Classification> {
    const data = await this.post("/api/v1/classify", { address });
    return data as Classification;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.url}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let json: { ok?: boolean; data?: unknown; error?: { message?: string } };
      try {
        json = (await res.json()) as typeof json;
      } catch {
        throw new ChainSageError(`Risk API returned a non-JSON response (HTTP ${res.status}).`);
      }
      if (!json.ok) {
        throw new ChainSageError(
          `Risk API error (HTTP ${res.status}): ${json.error?.message ?? "unknown"}`
        );
      }
      return json.data;
    } catch (err) {
      if (err instanceof ChainSageError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ChainSageError(`Risk API request timed out after ${this.timeoutMs}ms.`, err);
      }
      throw new ChainSageError(
        `Risk API request failed: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
