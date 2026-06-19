type Props = {
  size?: number;
  className?: string;
  title?: string;
};

/** ChainSage mark — intent node → decision diamond → execution node. */
export function SageMark({ size = 32, className, title = "ChainSage" }: Props) {
  // Static gradient ids. Every instance renders the SAME gradients, so a shared
  // id is safe (url(#…) resolves to the first identical def) and — unlike a
  // render-time counter — stays deterministic, so SSR and client hydration
  // produce matching markup. (Mirrors components/Brand.tsx's SageMark.)
  const id = "sml";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient
          id={`${id}-g`}
          x1="20"
          y1="100"
          x2="100"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="0.55" stopColor="#9C82FF" />
          <stop offset="1" stopColor="#5B8DEF" />
        </linearGradient>
        <linearGradient
          id={`${id}-c`}
          x1="46"
          y1="46"
          x2="74"
          y2="74"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#B9A5FF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      <g
        stroke={`url(#${id}-g)`}
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M28 92 Q44 76 56 64" />
        <path d="M64 56 Q80 44 92 28" />
        <path d="M92 92 Q74 74 64 64" />
      </g>
      <circle
        cx="28"
        cy="92"
        r="9"
        fill="var(--node-fill)"
        stroke={`url(#${id}-g)`}
        strokeWidth="4.5"
      />
      <circle cx="92" cy="28" r="9" fill={`url(#${id}-g)`} />
      <circle
        cx="92"
        cy="92"
        r="7"
        fill="var(--node-fill)"
        stroke={`url(#${id}-g)`}
        strokeWidth="4"
      />
      <rect
        x="46"
        y="46"
        width="28"
        height="28"
        rx="7"
        transform="rotate(45 60 60)"
        fill={`url(#${id}-c)`}
      />
      <rect
        x="52.5"
        y="52.5"
        width="15"
        height="15"
        rx="3.5"
        transform="rotate(45 60 60)"
        fill="#0B0B12"
        opacity="0.5"
      />
    </svg>
  );
}
