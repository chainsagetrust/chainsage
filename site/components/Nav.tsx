"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SageMark } from "./SageMark";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui";

const LINKS = [
  { label: "The Layer", href: "#missing-layer" },
  { label: "How it Works", href: "#how" },
  { label: "Product", href: "#roadmap" },
  { label: "Demo", href: "#demo" },
  { label: "Virtuals", href: "#virtuals" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4"
    >
      <nav
        className={`flex w-full max-w-6xl items-center justify-between gap-4 rounded-full border px-4 py-2.5 transition-all duration-300 sm:px-5 ${
          scrolled
            ? "border-[var(--card-border)] bg-[var(--card)] shadow-[var(--glass-shadow)] backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5" aria-label="ChainSage home">
          <SageMark size={30} />
          <span className="font-display text-[1.05rem] font-extrabold tracking-[-0.02em] text-text">
            ChainSage
          </span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-3 py-2 text-[0.9rem] font-medium text-text-2 transition-colors hover:text-text"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <div className="hidden sm:block">
            <Button href="/app" className="px-4 py-2 text-[0.9rem]">
              Launch App
            </Button>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card)] md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <div className="flex flex-col gap-[5px]">
              <span
                className={`h-[2px] w-4 bg-text transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`}
              />
              <span className={`h-[2px] w-4 bg-text transition-opacity ${open ? "opacity-0" : ""}`} />
              <span
                className={`h-[2px] w-4 bg-text transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
              />
            </div>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-4 right-4 top-[4.5rem] rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-3 backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-text-2 hover:bg-[var(--hairline)] hover:text-text"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="mt-2">
                <Button href="/app" className="w-full">
                  Launch App
                </Button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
