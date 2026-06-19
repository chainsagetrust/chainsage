"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/**
 * Pointer-parallax hook for the hero. Tracks normalized pointer position in
 * [-1, 1] on the element the handlers are attached to and exposes spring-smoothed
 * motion values, so consumers can derive opposite/with-pointer transforms for a
 * layered depth effect.
 *
 * Safe by construction:
 *  - Updates motion values only (no React state) → zero re-renders per frame.
 *  - Fine-pointer only: gated behind `(pointer: fine)`; touch never fires it.
 *  - Honors `prefers-reduced-motion: reduce` (stays centered, disabled).
 */
export function usePointerParallax() {
  const reduce = useReducedMotion();

  // Raw normalized pointer (-1..1), then spring-smoothed for buttery motion.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 110, damping: 20, mass: 0.4 } as const;
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);

  const enabled = useRef(false);

  useEffect(() => {
    if (reduce || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: fine)");
    const sync = () => {
      enabled.current = mq.matches;
      if (!mq.matches) {
        px.set(0);
        py.set(0);
      }
    };
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, [reduce, px, py]);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (reduce || !enabled.current) return;
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  return { sx, sy, onPointerMove, onPointerLeave, reduce: !!reduce };
}
