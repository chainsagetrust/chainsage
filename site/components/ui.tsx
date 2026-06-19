import type { ReactNode } from "react";
import Link from "next/link";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-text-2 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-2xl text-center"
          : "max-w-2xl text-left"
      }
    >
      {eyebrow ? (
        <div className={align === "center" ? "flex justify-center" : ""}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      ) : null}
      <h2 className="mt-5 font-display text-[1.9rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-text sm:text-[2.6rem]">
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 text-[1.05rem] leading-relaxed text-text-2">{intro}</p>
      ) : null}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  external?: boolean;
  ariaLabel?: string;
};

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  external,
  ariaLabel,
}: ButtonProps) {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform active:scale-[0.98]";
  const styles =
    variant === "primary"
      ? "cs-sheen text-white shadow-[0_8px_30px_rgba(124,92,255,0.35)] hover:shadow-[0_10px_40px_rgba(124,92,255,0.5)] hover:-translate-y-0.5 [background:var(--brand-gradient)]"
      : "border border-[var(--card-border)] bg-[var(--card)] text-text backdrop-blur hover:border-[var(--primary)] hover:-translate-y-0.5";
  const cls = `${base} ${styles} ${className}`;

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
          aria-label={ariaLabel}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

export function GlassCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`cs-glass ${className}`}>{children}</div>;
}
