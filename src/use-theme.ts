import { useEffect, useLayoutEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "minesweeper-theme";

function readStored(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  const s = localStorage.getItem(STORAGE_KEY);
  if (s === "light" || s === "dark" || s === "system") return s;
  return null;
}

export function applyThemeToDocument(preference: ThemePreference) {
  const root = document.documentElement;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const dark = preference === "dark" || (preference === "system" && mql.matches);
  root.classList.toggle("dark", dark);
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(() => readStored() ?? "system");

  useLayoutEffect(() => {
    applyThemeToDocument(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDocument("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [preference]);

  return { preference, setPreference };
}
