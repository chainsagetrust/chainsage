"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/useTheme";

/** Premium animated Midnight ⇄ Aurora toggle. */
export function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();
  const isAurora = theme === "aurora";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isAurora ? "Midnight" : "Aurora"} theme`}
      aria-pressed={isAurora}
      className="relative flex h-9 w-[3.75rem] items-center rounded-full border border-[var(--card-border)] bg-[var(--card)] px-1 backdrop-blur transition-colors duration-300 hover:border-[var(--primary)]"
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={{
          background: isAurora
            ? "linear-gradient(135deg, rgba(91,141,239,0.25), rgba(185,165,255,0.25))"
            : "linear-gradient(135deg, rgba(124,92,255,0.22), rgba(14,10,30,0.0))",
        }}
        transition={{ duration: 0.4 }}
      />
      <motion.span
        layout
        className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg)] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        animate={{ x: isAurora ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {mounted && isAurora ? (
            <motion.svg
              key="sun"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              stroke="var(--accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </motion.svg>
          ) : (
            <motion.svg
              key="moon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              stroke="var(--secondary)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}
