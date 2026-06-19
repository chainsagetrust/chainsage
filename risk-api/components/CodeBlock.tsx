"use client";

import { useState } from "react";
import { Copy, CheckC } from "./Brand";

/** A mono code panel with a copy-to-clipboard button. */
export function CodeBlock({
  code,
  label,
  language = "bash",
}: {
  code: string;
  label?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="overflow-hidden rounded-cs border border-hairline bg-[var(--bg-2)]">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="micro text-text-3">{label ?? language}</span>
        <button
          onClick={copy}
          className="mono inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-2 transition-colors hover:text-text"
          aria-label="Copy code"
        >
          {copied ? <CheckC size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mono overflow-x-auto px-4 py-3 text-[13px] leading-relaxed text-text-2">
        <code>{code}</code>
      </pre>
    </div>
  );
}
