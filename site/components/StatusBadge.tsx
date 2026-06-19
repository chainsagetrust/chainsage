import { chainsageColors } from "@/lib/tokens";

/**
 * Truthful per-route status. These labels are the product's honesty thesis
 * applied to itself — only Guardian is LIVE (it really reads Base mainnet, the
 * user verified it). PREVIEW = real, tested engine that does not yet enforce
 * against live signing. DOCS = a package/API surfaced as documentation.
 * BUILDING = not yet built.
 *
 * The sacred verdict palette (amber/red) is reserved for ALLOW/REVIEW/DENY, so
 * PREVIEW/DOCS use cyan/violet here — green is allowed for LIVE as the single
 * "go / working now" signal.
 */
export type RouteStatus = "LIVE" | "PREVIEW" | "DOCS" | "BUILDING";

const STATUS: Record<RouteStatus, { color: string; help: string }> = {
  LIVE: { color: chainsageColors.trust, help: "Working now — reads Base mainnet" },
  PREVIEW: {
    color: chainsageColors.cyan,
    help: "Real, tested engine; not yet enforcing against live signing",
  },
  DOCS: { color: chainsageColors.primary, help: "Developer documentation" },
  BUILDING: { color: "var(--text-3)", help: "Not yet built" },
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: RouteStatus;
  className?: string;
}) {
  const s = STATUS[status];
  const muted = status === "BUILDING";
  return (
    <span
      title={s.help}
      className={`micro inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${className}`}
      style={{
        color: s.color,
        borderColor: muted ? "var(--card-border)" : `${s.color}66`,
        background: muted ? "transparent" : `${s.color}14`,
      }}
    >
      <span
        className="block h-1.5 w-1.5 rounded-full"
        style={{ background: s.color }}
      />
      {status}
    </span>
  );
}
