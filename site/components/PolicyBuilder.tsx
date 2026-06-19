"use client";

/**
 * PolicyBuilder — the owner-facing form (Deliverable B). Every control maps 1:1
 * to a field of the engine's `Policy`. Editing any control calls `onChange` with
 * the next policy; the parent re-evaluates the bench instantly and persists.
 *
 * Spend amounts are edited in WHOLE token units and stored as raw bigint (the
 * chain's unit) using each token's decimals — there is one source of truth.
 */
import { useState } from "react";
import type { Policy, Address, FreshContractPolicy } from "@chainsage/policy-engine";
import { USDC, WETH, TOKEN_META, shortAddr } from "@/lib/samples";
import { Spark, Ban, Lock, Check } from "@/components/Brand";

const CHAIN_OPTIONS = ["base", "ethereum", "optimism", "arbitrum"];
const TOKEN_OPTIONS: { address: Address; symbol: string; decimals: number }[] = [
  { address: USDC, symbol: "USDC", decimals: TOKEN_META[USDC.toLowerCase()].decimals },
  { address: WETH, symbol: "WETH", decimals: TOKEN_META[WETH.toLowerCase()].decimals },
];

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function decimalsOf(token: Address): number {
  return TOKEN_META[token.toLowerCase()]?.decimals ?? 18;
}
const toRaw = (whole: number, decimals: number) => BigInt(Math.max(0, Math.floor(whole))) * 10n ** BigInt(decimals);
const toWhole = (raw: bigint, decimals: number) => Number(raw / 10n ** BigInt(decimals));

export function PolicyBuilder({
  policy,
  onChange,
}: {
  policy: Policy;
  onChange: (p: Policy) => void;
}) {
  const patch = (p: Partial<Policy>) => onChange({ ...policy, ...p });

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader />

      {/* Spend limits */}
      <Card title="Spend limits" hint="Per-token caps, in whole token units. A capped amount that's exceeded → DENY.">
        <div className="flex flex-col gap-2.5">
          {(policy.spendLimits ?? []).map((row, i) => {
            const dec = decimalsOf(row.token);
            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <Field label="Token">
                  <select
                    value={row.token.toLowerCase()}
                    onChange={(e) => {
                      const next = TOKEN_OPTIONS.find((t) => t.address.toLowerCase() === e.target.value)!;
                      const limits = [...(policy.spendLimits ?? [])];
                      limits[i] = { ...row, token: next.address };
                      patch({ spendLimits: limits });
                    }}
                    className="mono w-full rounded-cs border border-card-border bg-transparent px-2.5 py-2 text-sm outline-none focus:border-primary"
                  >
                    {TOKEN_OPTIONS.map((t) => (
                      <option key={t.address} value={t.address.toLowerCase()} className="bg-bg-2">
                        {t.symbol}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Max / tx">
                  <NumInput
                    value={toWhole(row.maxPerTx, dec)}
                    onChange={(v) => {
                      const limits = [...(policy.spendLimits ?? [])];
                      limits[i] = { ...row, maxPerTx: toRaw(v, dec) };
                      patch({ spendLimits: limits });
                    }}
                  />
                </Field>
                <Field label="Max / day">
                  <NumInput
                    value={toWhole(row.maxPerDay, dec)}
                    onChange={(v) => {
                      const limits = [...(policy.spendLimits ?? [])];
                      limits[i] = { ...row, maxPerDay: toRaw(v, dec) };
                      patch({ spendLimits: limits });
                    }}
                  />
                </Field>
                <IconButton
                  label="Remove"
                  onClick={() => patch({ spendLimits: (policy.spendLimits ?? []).filter((_, j) => j !== i) })}
                >
                  <Ban size={16} />
                </IconButton>
              </div>
            );
          })}
          <button
            onClick={() =>
              patch({
                spendLimits: [
                  ...(policy.spendLimits ?? []),
                  { token: USDC, maxPerTx: toRaw(1000, 6), maxPerDay: toRaw(5000, 6) },
                ],
              })
            }
            className="mt-1 self-start rounded-cs border border-dashed border-card-border px-3 py-1.5 text-sm text-text-2 transition hover:border-primary hover:text-text"
          >
            + Add spend limit
          </button>
        </div>
      </Card>

      {/* Chains */}
      <Card title="Allowed chains" hint="When any chain is selected, intents on other chains → DENY. None selected = no chain restriction.">
        <div className="flex flex-wrap gap-2">
          {CHAIN_OPTIONS.map((c) => {
            const on = (policy.allowedChains ?? []).includes(c);
            return (
              <Chip
                key={c}
                on={on}
                onClick={() => {
                  const set = new Set(policy.allowedChains ?? []);
                  on ? set.delete(c) : set.add(c);
                  patch({ allowedChains: [...set] });
                }}
              >
                {c}
              </Chip>
            );
          })}
        </div>
      </Card>

      {/* Allowed protocols */}
      <Card title="Allowed protocols / payees" hint="Allowlist of spenders, routers and payees. An off-list counterparty → REVIEW (unknown, not forbidden).">
        <AddressList
          items={policy.allowedProtocols ?? []}
          onChange={(items) => patch({ allowedProtocols: items })}
          accent="allow"
        />
      </Card>

      {/* Blocked protocols */}
      <Card title="Blocked protocols" hint="Denylist. A hit always → DENY and takes precedence over everything.">
        <AddressList
          items={policy.blockedProtocols ?? []}
          onChange={(items) => patch({ blockedProtocols: items })}
          accent="block"
        />
      </Card>

      {/* Unlimited approvals */}
      <Card title="Unlimited approvals" hint="When off, any unlimited approval → DENY — regardless of how trusted the spender is.">
        <Toggle
          on={policy.approvalRules?.allowUnlimited ?? false}
          onLabel="Allowed"
          offLabel="Forbidden"
          onClick={() => patch({ approvalRules: { allowUnlimited: !(policy.approvalRules?.allowUnlimited ?? false) } })}
        />
      </Card>

      {/* Trust threshold */}
      <Card title="Trust threshold" hint="Minimum counterparty trust (0–1) to avoid REVIEW. Set 0 to disable.">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={policy.trustThreshold ?? 0}
            onChange={(e) => patch({ trustThreshold: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="mono w-12 text-right text-sm tabular-nums">
            {(policy.trustThreshold ?? 0).toFixed(2)}
          </span>
        </div>
      </Card>

      {/* Fresh-contract policy */}
      <Card title="Freshly deployed contracts" hint="How to treat a counterparty deployed in the last 7 days — the strongest drainer signal.">
        <Segmented
          value={policy.freshContractPolicy ?? "allow"}
          options={[
            { value: "allow", label: "Allow" },
            { value: "review", label: "Review" },
            { value: "deny", label: "Deny" },
          ]}
          onChange={(v) => patch({ freshContractPolicy: v as FreshContractPolicy })}
        />
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- subcomponents */

function SectionHeader() {
  return (
    <div className="flex items-center gap-2 text-text-2">
      <Spark size={18} className="text-primary" />
      <h2 className="text-lg font-bold text-text">Policy builder</h2>
      <span className="micro ml-auto text-text-3">EDITS APPLY LIVE</span>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="cs-glass p-4">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-text-3">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="micro mb-1 block text-text-3">{label}</span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mono w-full rounded-cs border border-card-border bg-transparent px-2.5 py-2 text-sm outline-none focus:border-primary"
    />
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-cs border border-card-border text-text-3 transition hover:border-danger hover:text-danger"
    >
      {children}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`mono rounded-full border px-3 py-1.5 text-sm transition ${
        on
          ? "border-primary bg-primary/15 text-text"
          : "border-card-border text-text-3 hover:border-primary/50 hover:text-text-2"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  onLabel,
  offLabel,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3"
      aria-pressed={on}
    >
      <span
        className={`relative h-6 w-11 rounded-full border transition ${
          on ? "border-primary bg-primary/30" : "border-card-border bg-hairline"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-text transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      <span className="text-sm font-medium">{on ? onLabel : offLabel}</span>
      <span className="text-text-3">{on ? <Lock size={15} /> : <Lock size={15} />}</span>
    </button>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-cs border border-card-border p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[10px] px-4 py-1.5 text-sm transition ${
            value === o.value ? "bg-primary/20 font-semibold text-text" : "text-text-3 hover:text-text-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AddressList({
  items,
  onChange,
  accent,
}: {
  items: Address[];
  onChange: (items: Address[]) => void;
  accent: "allow" | "block";
}) {
  const [draft, setDraft] = useState("");
  const valid = ADDR_RE.test(draft.trim());
  const dup = items.some((a) => a.toLowerCase() === draft.trim().toLowerCase());

  const add = () => {
    if (!valid || dup) return;
    onChange([...items, draft.trim() as Address]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {items.map((a) => (
            <div
              key={a}
              className="flex items-center justify-between rounded-cs border border-card-border px-3 py-1.5"
            >
              <span className="mono text-sm text-text-2" title={a}>
                {shortAddr(a)}
              </span>
              <button
                onClick={() => onChange(items.filter((x) => x !== a))}
                aria-label="Remove address"
                className="text-text-3 transition hover:text-danger"
              >
                <Ban size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="0x…"
          spellCheck={false}
          className="mono w-full rounded-cs border border-card-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-text-3 focus:border-primary"
        />
        <button
          onClick={add}
          disabled={!valid || dup}
          className={`flex items-center gap-1 rounded-cs px-3 py-2 text-sm font-semibold transition disabled:opacity-40 ${
            accent === "block"
              ? "border border-card-border hover:border-danger"
              : "border border-card-border hover:border-primary"
          }`}
        >
          <Check size={15} /> Add
        </button>
      </div>
      {draft && !valid && <p className="text-xs text-text-3">Enter a full 0x address (40 hex chars).</p>}
      {dup && <p className="text-xs text-text-3">Already in the list.</p>}
    </div>
  );
}
