import type { CSSProperties } from "react";

import type { GameState } from "@/game.ts";
import type { HintRole } from "@/hints.ts";
import type { ActionMode } from "@/lib/game-settings.ts";
import { BoardCell } from "@/components/board/board-cell.tsx";

export const BOARD_CELL_SIZE = 32;

export function BoardGrid({
  game,
  gameOver,
  highlights,
  defaultAction,
  longPressEnabled,
  longPressMs,
  cellBorders,
  onPrimaryAction,
  onSecondaryAction,
  registerCell,
}: {
  game: GameState;
  gameOver: boolean;
  highlights: ReadonlyMap<string, HintRole>;
  defaultAction: ActionMode;
  longPressEnabled: boolean;
  longPressMs: number;
  cellBorders: boolean;
  onPrimaryAction: (row: number, col: number) => void;
  onSecondaryAction: (row: number, col: number) => void;
  registerCell: (key: string, node: HTMLButtonElement | null) => void;
}) {
  return (
    <div
      className="board-grid"
      style={
        {
          width: game.cols * BOARD_CELL_SIZE,
          height: game.rows * BOARD_CELL_SIZE,
          gridTemplateColumns: `repeat(${game.cols}, ${BOARD_CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${game.rows}, ${BOARD_CELL_SIZE}px)`,
        } as CSSProperties
      }
    >
      {Array.from({ length: game.rows }, (_, row) =>
        Array.from({ length: game.cols }, (_, col) => (
          <BoardCell
            key={`${row}-${col}`}
            cell={game.cells[row * game.cols + col]!}
            row={row}
            col={col}
            gameOver={gameOver}
            highlight={highlights.get(`${row},${col}`)}
            defaultAction={defaultAction}
            longPressEnabled={longPressEnabled}
            longPressMs={longPressMs}
            cellBorders={cellBorders}
            onPrimaryAction={onPrimaryAction}
            onSecondaryAction={onSecondaryAction}
            registerCell={registerCell}
          />
        )),
      )}
    </div>
  );
}
