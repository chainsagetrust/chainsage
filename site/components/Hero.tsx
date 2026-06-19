"use client";

import { motion, useReducedMotion, useTransform } from "framer-motion";
import { Eyebrow, Button } from "./ui";
import { VerdictEngine } from "./VerdictEngine";
import { usePointerParallax } from "./heroMotion";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const reduce = useReducedMotion();
  const { sx, sy, onPointerMove, onPointerLeave } = usePointerParallax();

  // Content shifts OPPOSITE the pointer (~9px); the deeper orb layer shifts WITH
  // it (~17px). More movement on the deeper layer reads as depth.
  const contentX = useTransform(sx, (v) => v * -9);
  const contentY = useTransform(sy, (v) => v * -9);
  const orbX = useTransform(sx, (v) => v * 17);
  const orbY = useTransform(sy, (v) => v * 17);

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: EASE },
        };

  return (
    <section
      id="top"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative overflow-hidden"
    >
      {/* Hero-scoped depth orbs — decorative, theme-tuned, pointer-parallaxed.
          Idle drift is CSS (on the orbs); pointer parallax is the wrapper transform. */}
      <motion.div
        aria-hidden
        style={{ x: orbX, y: orbY }}
        className="cs-hero-orbs pointer-events-none absolute inset-0 z-0"
      >
        <span className="cs-hero-orb cs-hero-orb-a" />
        <span className="cs-hero-orb cs-hero-orb-b" />
      </motion.div>

      <motion.div
        style={{ x: contentX, y: contentY }}
        className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-40"
      >
      <div>
        <motion.div {...rise(0)}>
          <Eyebrow>Read-only · the verdict before execution</Eyebrow>
        </motion.div>

        <motion.h1
          {...rise(0.08)}
          className="mt-6 font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-text sm:text-[3.75rem]"
        >
          Trust Layer for{" "}
          <span className="cs-gradient-text">Autonomous Finance</span>
        </motion.h1>

        <motion.div
          {...rise(0.16)}
          className="mt-7 space-y-1 font-mono text-[0.95rem] leading-relaxed text-text-2"
        >
          <p>Settlement moves money.</p>
          <p>Authorization grants permission.</p>
          <p className="text-text">
            <span className="cs-gradient-text font-semibold">ChainSage</span>{" "}
            decides whether it should happen.
          </p>
        </motion.div>

        <motion.p
          {...rise(0.24)}
          className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-text-2"
        >
          The decision engine between an AI agent&apos;s intent and on-chain
          execution. Every transaction is simulated, scored, and checked against
          policy and a shared trust network — then returned as a single verdict:
          ALLOW, REVIEW, or DENY.
        </motion.p>

        <motion.div {...rise(0.32)} className="mt-9 flex flex-wrap gap-3">
          <Button href="/app">Launch App</Button>
          <Button href="#demo" variant="ghost">
            Watch Demo
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
      >
        <VerdictEngine />
      </motion.div>
      </motion.div>
    </section>
  );
}
