import { useCallback, useEffect, useRef } from "react";
import { Flag } from "lucide-react";

import type { HintRole } from "@/hints.ts";
import type { Cell } from "@/game.ts";
import { cn } from "@/lib/utils.ts";
import type { ActionMode } from "@/lib/game-settings.ts";

const NUMBER_COLORS: Record<number, string> = {
  1: "text-[var(--n1)]",
  2: "text-[var(--n2)]",
  3: "text-[var(--n3)]",
  4: "text-[var(--n4)]",
  5: "text-[var(--n5)]",
  6: "text-[var(--n6)]",
  7: "text-[var(--n7)]",
  8: "text-[var(--n8)]",
};

function hiddenCellClasses(cellBorders: boolean) {
  return cellBorders
    ? "board-cell board-cell--hidden board-cell--bordered"
    : "board-cell board-cell--hidden";
}

export function BoardCell({
  cell,
  row,
  col,
  gameOver,
  highlight,
  defaultAction,
  longPressEnabled,
  longPressMs,
  cellBorders,
  onPrimaryAction,
  onSecondaryAction,
  registerCell,
}: {
  cell: Cell;
  row: number;
  col: number;
  gameOver: boolean;
  highlight?: HintRole;
  defaultAction: ActionMode;
  longPressEnabled: boolean;
  longPressMs: number;
  cellBorders: boolean;
  onPrimaryAction: (row: number, col: number) => void;
  onSecondaryAction: (row: number, col: number) => void;
  registerCell: (key: string, node: HTMLButtonElement | null) => void;
}) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClickRef = useRef(false);
  const recentPointerTypeRef = useRef<string | null>(null);
  const recentLongPressRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (longPressTimerRef.current !== undefined) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const runAction = useCallback(
    (mode: ActionMode) => {
      if (mode === "reveal") onPrimaryAction(row, col);
      else onSecondaryAction(row, col);
    },
    [col, onPrimaryAction, onSecondaryAction, row],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      recentPointerTypeRef.current = event.pointerType;
      if (cell.revealed || gameOver || event.pointerType === "mouse" || event.button !== 0) {
        return;
      }
      touchStartRef.current = { x: event.clientX, y: event.clientY };
      if (!longPressEnabled) return;
      clearTimer();
      longPressTimerRef.current = setTimeout(() => {
        suppressClickRef.current = true;
        recentLongPressRef.current = true;
        runAction(defaultAction === "reveal" ? "flag" : "reveal");
        window.setTimeout(() => {
          recentLongPressRef.current = false;
        }, 500);
      }, longPressMs);
    },
    [cell.revealed, clearTimer, defaultAction, gameOver, longPressEnabled, longPressMs, runAction],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!touchStartRef.current) return;
      if (
        Math.abs(event.clientX - touchStartRef.current.x) > 10 ||
        Math.abs(event.clientY - touchStartRef.current.y) > 10
      ) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const handlePointerUp = useCallback(() => {
    touchStartRef.current = null;
    clearTimer();
  }, [clearTimer]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const pointerType = recentPointerTypeRef.current;
      if (pointerType === "touch" || pointerType === "pen") {
        runAction(defaultAction);
      } else {
        onPrimaryAction(row, col);
      }
    },
    [defaultAction, onPrimaryAction, row, col, runAction],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (recentLongPressRef.current) return;
      onSecondaryAction(row, col);
    },
    [col, onSecondaryAction, row],
  );

  const wrongFlag = gameOver && cell.flagged && !cell.isMine;

  let content: React.ReactNode = null;
  if (cell.flagged && !gameOver) {
    content = <Flag className="size-4 text-destructive" strokeWidth={2.25} aria-hidden />;
  } else if (cell.revealed && cell.isMine) {
    content = <span className="size-3 rounded-full bg-destructive" aria-hidden />;
  } else if (cell.revealed && cell.adjacent > 0) {
    content = (
      <span className={cn("tabular-nums", NUMBER_COLORS[cell.adjacent])}>{cell.adjacent}</span>
    );
  }

  return (
    <button
      ref={(node) => registerCell(`${row},${col}`, node)}
      type="button"
      className={cn(
        "relative grid size-full place-items-center overflow-hidden p-0 text-[0.92rem] font-bold leading-none select-none",
        cell.revealed ? "board-cell board-cell--revealed" : hiddenCellClasses(cellBorders),
        cell.revealed && cell.isMine && "board-cell--mine",
        wrongFlag && "board-cell--wrong-flag",
        highlight === "focus" && "ring-2 ring-amber-400/90 ring-inset",
        highlight === "error-clue" && "ring-2 ring-destructive ring-inset",
        highlight === "error-near" && "ring-2 ring-amber-500/80 ring-inset",
        (highlight === "clue" || highlight === "clue-a" || highlight === "clue-b") &&
          "ring-2 ring-sky-400/70 ring-inset",
        highlight === "scope" && "bg-sky-400/8",
      )}
      aria-label={`Cell row ${row + 1} column ${col + 1}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <span className="board-cell__content">{content}</span>
    </button>
  );
}
