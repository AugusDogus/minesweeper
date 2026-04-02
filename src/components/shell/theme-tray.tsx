import { Check } from "lucide-react";

import { THEME_OPTIONS, type ThemeName } from "@/lib/themes.ts";
import { cn } from "@/lib/utils.ts";

export function ThemeTray({
  open,
  themeName,
  onChange,
}: {
  open: boolean;
  themeName: ThemeName;
  onChange: (themeName: ThemeName) => void;
}) {
  return (
    <div className={cn("theme-tray", open ? "theme-tray--open" : "theme-tray--closed")}>
      {THEME_OPTIONS.map((theme) => (
        <button
          key={theme.name}
          type="button"
          className={cn(
            "theme-tray__option",
            theme.name === themeName && "theme-tray__option--active",
          )}
          onClick={() => onChange(theme.name)}
        >
          <span className="theme-tray__swatch" data-theme-swatch={theme.name} />
          <span className="theme-tray__label">{theme.label}</span>
          {theme.name === themeName ? <Check className="size-3.5" /> : null}
        </button>
      ))}
    </div>
  );
}
