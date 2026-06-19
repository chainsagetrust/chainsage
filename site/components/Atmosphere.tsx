"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Fixed background atmosphere: 3 blurred gradient orbs (2 drifting), a masked
 * grid, and subtle SVG noise. Orbs parallax on scroll. Calm, never busy.
 * Uses only decorative accents (primary/secondary/accent/cyan) — never verdict.
 */
export function Atmosphere() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1600], [0, reduce ? 0 : -160]);
  const y2 = useTransform(scrollY, [0, 1600], [0, reduce ? 0 : 120]);
  const y3 = useTransform(scrollY, [0, 1600], [0, reduce ? 0 : -80]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Orb 1 — primary, top-left, drifting */}
      <motion.div
        style={{ y: y1 }}
        className="absolute -left-[12%] -top-[8%] h-[42rem] w-[42rem]"
      >
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(124,92,255,0.55), transparent 62%)",
            filter: "blur(80px)",
          }}
          animate={
            reduce
              ? undefined
              : { x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.06, 0.98, 1] }
          }
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Orb 2 — accent blue, right, drifting */}
      <motion.div
        style={{ y: y2 }}
        className="absolute -right-[14%] top-[24%] h-[40rem] w-[40rem]"
      >
        <motion.div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 60% 40%, rgba(91,141,239,0.45), transparent 62%)",
            filter: "blur(90px)",
          }}
          animate={
            reduce
              ? undefined
              : { x: [0, -50, 30, 0], y: [0, 30, -20, 0], scale: [1, 1.08, 0.96, 1] }
          }
          transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* Orb 3 — secondary, lower center, static parallax only */}
      <motion.div
        style={{ y: y3 }}
        className="absolute left-[34%] top-[62%] h-[34rem] w-[34rem]"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(156,130,255,0.30), transparent 64%)",
            filter: "blur(100px)",
          }}
        />
      </motion.div>

      {/* Masked grid */}
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(110% 80% at 50% 0%, #000 35%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(110% 80% at 50% 0%, #000 35%, transparent 78%)",
        }}
      />

      {/* SVG noise */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
