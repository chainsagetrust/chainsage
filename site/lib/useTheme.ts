"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "midnight" | "aurora";

const STORAGE_KEY = "chainsage-theme";

function readTheme(): Theme {
  if (typeof document === "undefined") return "midnight";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "aurora" ? "aurora" : "midnight";
}

/** Theme hook bound to <html data-theme> + localStorage. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("midnight");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "aurora" ? "#F4F2FB" : "#0A0816");
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(readTheme() === "midnight" ? "aurora" : "midnight");
  }, [setTheme]);

  return { theme, setTheme, toggle, mounted };
}
