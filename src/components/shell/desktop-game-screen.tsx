import {
  CircleHelp,
  Flag,
  Frown,
  Palette,
  RotateCcw,
  Settings2,
  Sparkles,
  Timer,
} from "lucide-react";
import { useCallback, useState } from "react";

import { BoardGrid } from "@/components/board/board-grid.tsx";
import { ThemeTray } from "@/components/shell/theme-tray.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import type { Difficulty, GameState } from "@/game.ts";
import type { HintRole } from "@/hints.ts";
import type { GameSettings } from "@/lib/game-settings.ts";
import type { ThemeName } from "@/lib/themes.ts";

function formatTime(seconds: number): string {
  return String(Math.min(999, Math.floor(seconds))).padStart(3, "0");
}

const noopRegisterCell = () => undefined;

export function DesktopGameScreen({
  game,
  difficulty,
  difficulties,
  settings,
  themeName,
  minesRemaining,
  helpBanner,
  highlights,
  onHelp,
  onOpenSettings,
  onThemeChange,
  onPrimaryAction,
  onSecondaryAction,
  onStartDifficulty,
  onNewGame,
}: {
  game: GameState;
  difficulty: Difficulty;
  difficulties: readonly Difficulty[];
  settings: GameSettings;
  themeName: ThemeName;
  minesRemaining: number;
  helpBanner: string | null;
  highlights: ReadonlyMap<string, HintRole>;
  onHelp: () => void;
  onOpenSettings: () => void;
  onThemeChange: (themeName: ThemeName) => void;
  onPrimaryAction: (row: number, col: number) => void;
  onSecondaryAction: (row: number, col: number) => void;
  onStartDifficulty: (difficulty: Difficulty) => void;
  onNewGame: () => void;
}) {
  const gameOver = game.status === "won" || game.status === "lost";
  const [themeTrayOpen, setThemeTrayOpen] = useState(false);
  const handleThemeChange = useCallback(
    (nextThemeName: ThemeName) => {
      onThemeChange(nextThemeName);
      setThemeTrayOpen(false);
    },
    [onThemeChange],
  );

  return (
    <section className="desktop-shell">
      <div className="desktop-shell__header">
        <div>
          <h1 className="desktop-shell__title">Minesweeper</h1>
          <p className="desktop-shell__copy">
            Click to reveal. Right-click to flag. Pattern help stays on <kbd>H</kbd>.
          </p>
        </div>
        <div className="desktop-shell__header-actions">
          <div className="relative">
            <Button variant="outline" size="icon" onClick={() => setThemeTrayOpen((open) => !open)}>
              <Palette className="size-4" />
              <span className="sr-only">Choose theme</span>
            </Button>
            <ThemeTray open={themeTrayOpen} themeName={themeName} onChange={handleThemeChange} />
          </div>
          <Button variant="outline" size="icon" onClick={onOpenSettings}>
            <Settings2 className="size-4" />
            <span className="sr-only">Open settings</span>
          </Button>
          <Button variant="outline" size="icon" onClick={onHelp}>
            <CircleHelp className="size-4" />
            <span className="sr-only">Pattern help</span>
          </Button>
        </div>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        className="desktop-shell__difficulty"
        value={difficulty.id}
        onValueChange={(value) => {
          const nextDifficulty = difficulties.find((entry) => entry.id === value);
          if (nextDifficulty) onStartDifficulty(nextDifficulty);
        }}
      >
        {difficulties.map((entry) => (
          <ToggleGroupItem key={entry.id} value={entry.id} className="min-w-28">
            {entry.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="desktop-shell__stats">
        <div className="desktop-stat">
          <Flag className="size-4 text-muted-foreground" />
          <span>{String(minesRemaining).padStart(3, "0")}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onNewGame}>
          {gameOver ? (
            game.status === "won" ? (
              <Sparkles className="size-4" />
            ) : (
              <Frown className="size-4" />
            )
          ) : (
            <RotateCcw className="size-4" />
          )}
          <span className="sr-only">New game</span>
        </Button>
        <div className="desktop-stat">
          <Timer className="size-4 text-muted-foreground" />
          <span>{formatTime(game.elapsedSeconds)}</span>
        </div>
      </div>

      <div className="desktop-shell__board">
        <div className="desktop-board-frame">
          <BoardGrid
            game={game}
            gameOver={gameOver}
            highlights={highlights}
            defaultAction={settings.defaultAction}
            longPressEnabled={settings.longPressEnabled}
            longPressMs={settings.longPressMs}
            cellBorders={settings.cellBorders}
            onPrimaryAction={onPrimaryAction}
            onSecondaryAction={onSecondaryAction}
            registerCell={noopRegisterCell}
          />
        </div>
      </div>

      <p className="desktop-shell__banner" aria-live="polite">
        {gameOver
          ? game.status === "won"
            ? "You cleared the field."
            : "Boom. Reset and try again."
          : (helpBanner ??
            "Desktop stays click-first. Touch-only controls remain available in settings, but they are no longer pinned into the main layout.")}
      </p>
    </section>
  );
}
