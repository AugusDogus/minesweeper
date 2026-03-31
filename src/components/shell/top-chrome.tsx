import { House, Palette, Settings2, Sparkle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { ThemeTray } from "@/components/shell/theme-tray.tsx";
import type { ThemeName } from "@/lib/themes.ts";

export function TopChrome({
  themeName,
  onThemeChange,
  onHome,
  onOpenSettings,
  onHelp,
}: {
  themeName: ThemeName;
  onThemeChange: (themeName: ThemeName) => void;
  onHome: () => void;
  onOpenSettings: () => void;
  onHelp: () => void;
}) {
  const [trayOpen, setTrayOpen] = useState(false);

  return (
    <div className="top-chrome">
      <Button variant="ghost" size="icon" className="top-chrome__button" onClick={onHome}>
        <House className="size-4" />
        <span className="sr-only">Back to menu</span>
      </Button>
      <div className="top-chrome__actions">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="top-chrome__button"
            onClick={() => setTrayOpen((open) => !open)}
          >
            <Palette className="size-4" />
            <span className="sr-only">Choose theme</span>
          </Button>
          <ThemeTray
            open={trayOpen}
            themeName={themeName}
            onChange={(nextTheme) => {
              onThemeChange(nextTheme);
              setTrayOpen(false);
            }}
          />
        </div>
        <Button variant="ghost" size="icon" className="top-chrome__button" onClick={onOpenSettings}>
          <Settings2 className="size-4" />
          <span className="sr-only">Open settings</span>
        </Button>
        <Button variant="ghost" size="icon" className="top-chrome__button" onClick={onHelp}>
          <Sparkle className="size-4" />
          <span className="sr-only">Pattern help</span>
        </Button>
      </div>
    </div>
  );
}
