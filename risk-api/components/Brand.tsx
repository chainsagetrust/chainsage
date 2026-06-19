/**
 * Brand.tsx — the Sage Mark (inlined from brand/assets/sage-mark.svg) plus the
 * stroke-icon subset the console uses. Icons are 1.8px stroke, currentColor.
 */
import type { SVGProps } from "react";

export function SageMark({
  size = 40,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ChainSage mark"
      {...props}
    >
      <defs>
        <linearGradient id="sm-mg" x1="20" y1="100" x2="100" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="0.55" stopColor="#9C82FF" />
          <stop offset="1" stopColor="#5B8DEF" />
        </linearGradient>
        <linearGradient id="sm-mc" x1="46" y1="46" x2="74" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#B9A5FF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      <g stroke="url(#sm-mg)" strokeWidth="5.5" strokeLinecap="round" fill="none">
        <path d="M28 92 Q44 76 56 64" />
        <path d="M64 56 Q80 44 92 28" />
        <path d="M92 92 Q74 74 64 64" />
      </g>
      <circle cx="28" cy="92" r="9" fill="#0E0A1E" stroke="url(#sm-mg)" strokeWidth="4.5" />
      <circle cx="92" cy="28" r="9" fill="url(#sm-mg)" />
      <circle cx="92" cy="92" r="7" fill="#0E0A1E" stroke="url(#sm-mg)" strokeWidth="4" />
      <rect x="46" y="46" width="28" height="28" rx="7" transform="rotate(45 60 60)" fill="url(#sm-mc)" />
      <rect x="52.5" y="52.5" width="15" height="15" rx="3.5" transform="rotate(45 60 60)" fill="#0B0B12" opacity="0.5" />
    </svg>
  );
}

type IconProps = { size?: number } & SVGProps<SVGSVGElement>;

function Icon({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckC = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Icon>
);

export const Ban = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
);

export const Hand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10" />
    <path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V10" />
    <path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 3.5-2.2 7-6 7-2.6 0-4-1.2-5.4-3.2l-2-3a1.5 1.5 0 0 1 2.4-1.8L8 14" />
  </Icon>
);

export const Arrow = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Icon>
);

export const External = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
  </Icon>
);

export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const Spark = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
  </Icon>
);

export const Copy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Icon>
);

export const Code = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 8l-4 4 4 4" />
    <path d="M16 8l4 4-4 4" />
  </Icon>
);

export const Gauge = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 18a9 9 0 1 1 14 0" />
    <path d="M12 13l4-3.5" />
    <circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const Scan = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2" />
    <path d="M20 8V6a2 2 0 0 0-2-2h-2" />
    <path d="M4 16v2a2 2 0 0 0 2 2h2" />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
    <path d="M4 12h16" />
  </Icon>
);
