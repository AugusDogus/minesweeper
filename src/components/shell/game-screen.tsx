import { Flag, Timer } from "lucide-react";

import { BoardViewport } from "@/components/board/board-viewport.tsx";
import type { BoardInteraction } from "@/components/board/use-board-animations.ts";
import { ActionToggleBar } from "@/components/shell/action-toggle-bar.tsx";
import { PostGamePanel } from "@/components/shell/post-game-panel.tsx";
import { TopChrome } from "@/components/shell/top-chrome.tsx";
import type { Difficulty, GameState } from "@/game.ts";
import type { HintRole } from "@/hints.ts";
import type { GameSettings } from "@/lib/game-settings.ts";
import type { ThemeName } from "@/lib/themes.ts";

function formatTime(seconds: number): string {
  return String(Math.min(999, Math.floor(seconds))).padStart(3, "0");
}

export function GameScreen({
  game,
  difficulty,
  selectedDifficulty,
  difficulties,
  settings,
  themeName,
  minesRemaining,
  helpBanner,
  highlights,
  interaction,
  onHome,
  onHelp,
  onOpenSettings,
  onThemeChange,
  onPrimaryAction,
  onSecondaryAction,
  onDifficultyChange,
  onNewGame,
  onSettingsChange,
}: {
  game: GameState;
  difficulty: Difficulty;
  selectedDifficulty: Difficulty;
  difficulties: readonly Difficulty[];
  settings: GameSettings;
  themeName: ThemeName;
  minesRemaining: number;
  helpBanner: string | null;
  highlights: ReadonlyMap<string, HintRole>;
  interaction: BoardInteraction;
  onHome: () => void;
  onHelp: () => void;
  onOpenSettings: () => void;
  onThemeChange: (themeName: ThemeName) => void;
  onPrimaryAction: (row: number, col: number) => void;
  onSecondaryAction: (row: number, col: number) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onNewGame: () => void;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
}) {
  const gameOver = game.status === "won" || game.status === "lost";
  const showActionToggle = settings.showActionToggle || !settings.longPressEnabled;

  return (
    <section className="game-screen">
      <TopChrome
        themeName={themeName}
        onThemeChange={onThemeChange}
        onHome={onHome}
        onOpenSettings={onOpenSettings}
        onHelp={onHelp}
      />

      <div className="hud-cluster" aria-live="polite">
        <div className="hud-pill">
          <Flag className="size-3.5" />
          <span>{String(minesRemaining).padStart(3, "0")}</span>
        </div>
        <div className="hud-pill">
          <Timer className="size-3.5" />
          <span>{formatTime(game.elapsedSeconds)}</span>
        </div>
      </div>

      <div className="game-screen__board">
        <BoardViewport
          game={game}
          gameOver={gameOver}
          settings={settings}
          highlights={highlights}
          interaction={interaction}
          resetKey={`${difficulty.id}-${game.status}-${game.started}-${game.rows}x${game.cols}`}
          onPrimaryAction={onPrimaryAction}
          onSecondaryAction={onSecondaryAction}
        />
      </div>

      <p className="game-screen__banner" aria-live="polite">
        {gameOver
          ? game.status === "won"
            ? "You cleared the field."
            : "Boom. Tap a new run when you’re ready."
          : (helpBanner ?? "Tap the board. Long-press uses the secondary action.")}
      </p>

      {showActionToggle ? (
        <div className="game-screen__toggle">
          <ActionToggleBar
            value={settings.defaultAction}
            onChange={(mode) => onSettingsChange({ defaultAction: mode })}
          />
        </div>
      ) : null}

      {gameOver ? (
        <PostGamePanel
          status={game.status}
          difficulty={selectedDifficulty}
          difficulties={difficulties}
          onDifficultyChange={onDifficultyChange}
          onNewGame={onNewGame}
        />
      ) : null}
    </section>
  );
}
