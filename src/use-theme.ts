import { useLayoutEffect, useState } from "react";

import { readStoredThemeName, writeStoredThemeName } from "@/lib/persistence.ts";
import { THEMES, type ThemeName } from "@/lib/themes.ts";

export function applyThemeToDocument(themeName: ThemeName) {
  const root = document.documentElement;
  const theme = THEMES[themeName];
  root.dataset.theme = themeName;
  root.classList.toggle("dark", theme.appearance === "dark");
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value);
  }
}

export function useThemePreference(initialThemeName?: ThemeName) {
  const [themeName, setThemeName] = useState<ThemeName>(
    () => initialThemeName ?? readStoredThemeName() ?? "classic-light",
  );

  useLayoutEffect(() => {
    applyThemeToDocument(themeName);
    writeStoredThemeName(themeName);
  }, [themeName]);

  return { themeName, setThemeName };
}
