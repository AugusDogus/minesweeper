import type { ReactNode } from "react";

import type { GameState } from "@/game.ts";
import type { HintRole } from "@/hints.ts";
import type { GameSettings } from "@/lib/game-settings.ts";
import { BoardGrid, BOARD_CELL_SIZE } from "@/components/board/board-grid.tsx";
import { BoardOverlay } from "@/components/board/board-overlay.tsx";
import type { BoardInteraction } from "@/components/board/use-board-animations.ts";
import { useBoardAnimations } from "@/components/board/use-board-animations.ts";
import { useBoardGestures } from "@/components/board/use-board-gestures.ts";

export function BoardViewport({
  game,
  gameOver,
  settings,
  highlights,
  interaction,
  resetKey,
  onPrimaryAction,
  onSecondaryAction,
  children,
}: {
  game: GameState;
  gameOver: boolean;
  settings: GameSettings;
  highlights: ReadonlyMap<string, HintRole>;
  interaction: BoardInteraction;
  resetKey: string;
  onPrimaryAction: (row: number, col: number) => void;
  onSecondaryAction: (row: number, col: number) => void;
  children?: ReactNode;
}) {
  const boardWidth = game.cols * BOARD_CELL_SIZE;
  const boardHeight = game.rows * BOARD_CELL_SIZE;
  const { effects, registerCell } = useBoardAnimations({
    game,
    interaction,
    cellSize: BOARD_CELL_SIZE,
    animationSpeed: settings.animationSpeed,
  });
  const { surfaceRef, viewportRef, viewportHandlers } = useBoardGestures({
    contentWidth: boardWidth,
    contentHeight: boardHeight,
    resetKey,
  });

  return (
    <div className="relative h-full min-h-[18rem] w-full">
      <div ref={viewportRef} className="board-viewport absolute inset-0" {...viewportHandlers}>
        <div ref={surfaceRef} className="board-surface">
          <div className="board-frame">
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
              registerCell={registerCell}
            />
            <BoardOverlay effects={effects} width={boardWidth} height={boardHeight} />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
