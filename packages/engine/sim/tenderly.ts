/**
 * sim/tenderly — the PRIMARY simulation provider.
 *
 * Tenderly's Simulation API executes the tx against live Base state and returns
 * decoded logs + asset changes — the most accurate and complete view we can get.
 * It is a THIRD-PARTY, PAID service (https://tenderly.co): simulations count
 * against your account quota and the tx is sent to Tenderly's servers. Used ONLY
 * when TENDERLY_ACCESS_KEY (+ account/project slugs) are configured. The key is
 * read server-side from the environment and never reaches the client.
 *
 * Read-only: we set save:false / simulation_type:"quick" and never broadcast.
 */
import type { Address } from "viem";
import { parseTenderlySimulation } from "./parse";
import type { ProviderResult, SimProviderImpl, SimTxRequest } from "./types";

const BASE_NETWORK_ID = "8453";

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

export interface TenderlyConfig {
  accessKey?: string;
  accountSlug?: string;
  projectSlug?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export function tenderlyConfigFromEnv(timeoutMs: number): TenderlyConfig {
  return {
    accessKey: env("TENDERLY_ACCESS_KEY"),
    accountSlug: env("TENDERLY_ACCOUNT_SLUG"),
    projectSlug: env("TENDERLY_PROJECT_SLUG"),
    timeoutMs,
  };
}

export class TenderlyProvider implements SimProviderImpl {
  readonly name = "tenderly" as const;
  private readonly cfg: TenderlyConfig;

  constructor(cfg: TenderlyConfig) {
    this.cfg = cfg;
  }

  async available(): Promise<boolean> {
    return !!(this.cfg.accessKey && this.cfg.accountSlug && this.cfg.projectSlug);
  }

  async run(tx: SimTxRequest): Promise<ProviderResult | null> {
    if (!(await this.available())) return null;
    const fetchImpl = this.cfg.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) return null;

    const url = `https://api.tenderly.co/api/v1/account/${this.cfg.accountSlug}/project/${this.cfg.projectSlug}/simulate`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Access-Key": this.cfg.accessKey as string,
        },
        body: JSON.stringify({
          network_id: BASE_NETWORK_ID,
          from: (tx.from as Address).toLowerCase(),
          to: (tx.to as Address).toLowerCase(),
          input: tx.data,
          value: tx.value.toString(),
          save: false,
          save_if_fails: false,
          simulation_type: "quick",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // A provider error must NOT look like a clean sim — fall through.
        return null;
      }
      const json = await res.json();
      const parsed = parseTenderlySimulation(json);
      return { parsed, effectsObserved: true };
    } catch {
      // Network error / timeout / abort → fall through to the next provider.
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
