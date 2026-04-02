import { CircleHelp, Palette, Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { DifficultySwipeSelector } from "@/components/shell/difficulty-swipe-selector.tsx";
import { ThemeTray } from "@/components/shell/theme-tray.tsx";
import type { Difficulty } from "@/game.ts";
import type { ThemeName } from "@/lib/themes.ts";

export function MenuScreen({
  difficulty,
  difficulties,
  canResume,
  themeName,
  onDifficultyChange,
  onNewGame,
  onResume,
  onHelp,
  onOpenSettings,
  onThemeChange,
}: {
  difficulty: Difficulty;
  difficulties: readonly Difficulty[];
  canResume: boolean;
  themeName: ThemeName;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onNewGame: () => void;
  onResume: () => void;
  onHelp: () => void;
  onOpenSettings: () => void;
  onThemeChange: (themeName: ThemeName) => void;
}) {
  const [trayOpen, setTrayOpen] = useState(false);

  return (
    <section className="menu-screen">
      <div className="menu-screen__toolbar">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="top-chrome__button"
            onClick={() => setTrayOpen((open) => !open)}
          >
            <Palette className="size-4" />
            <span className="sr-only">Open themes</span>
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
          <CircleHelp className="size-4" />
          <span className="sr-only">Open help</span>
        </Button>
      </div>

      <div className="menu-screen__hero">
        <p className="menu-screen__eyebrow">Dustland-Inspired Mobile Shell</p>
        <h1 className="menu-screen__title">Minesweeper</h1>
        <p className="menu-screen__copy">Board first. Quiet chrome. Fast touch controls.</p>
      </div>

      <DifficultySwipeSelector
        value={difficulty.id}
        onChange={onDifficultyChange}
        options={difficulties}
      />

      <div className="menu-screen__actions">
        <Button size="lg" className="menu-screen__primary" onClick={onNewGame}>
          New Game
        </Button>
        {canResume ? (
          <Button variant="outline" size="lg" onClick={onResume}>
            Resume
          </Button>
        ) : null}
      </div>
    </section>
  );
}
