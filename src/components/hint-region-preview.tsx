import { Flag } from "lucide-react";

import { HINT_CLUE_A_RING, HINT_CLUE_B_RING, HINT_SCOPE_SURFACE } from "@/lib/hint-clue-rings.ts";
import { cn } from "@/lib/utils";

import type { Hint, HintRole } from "@/hints.ts";

import type { Cell, GameState } from "@/game.ts";

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

function cellAt(state: GameState, row: number, col: number): Cell {
  return state.cells[row * state.cols + col]!;
}

/** Bounding box of all hinted cells, padded by 1 (clamped to the field). */
function hintBounds(hint: Hint, rows: number, cols: number) {
  let r0 = Infinity;
  let r1 = -Infinity;
  let c0 = Infinity;
  let c1 = -Infinity;
  for (const h of hint.cells) {
    r0 = Math.min(r0, h.row);
    r1 = Math.max(r1, h.row);
    c0 = Math.min(c0, h.col);
    c1 = Math.max(c1, h.col);
  }
  const pad = 1;
  r0 = Math.max(0, r0 - pad);
  c0 = Math.max(0, c0 - pad);
  r1 = Math.min(rows - 1, r1 + pad);
  c1 = Math.min(cols - 1, c1 + pad);
  return { r0, c0, r1, c1 };
}

function PreviewCell({ cell, highlight }: { cell: Cell; highlight?: HintRole }) {
  let content: React.ReactNode = null;
  if (cell.flagged)
    content = (
      <Flag className="size-[0.55em] shrink-0 text-destructive" strokeWidth={2.25} aria-hidden />
    );
  else if (cell.revealed && cell.isMine)
    content = (
      <span
        className="size-[0.5em] min-h-[0.5em] min-w-[0.5em] shrink-0 rounded-full bg-destructive"
        aria-hidden
      />
    );
  else if (cell.revealed && cell.adjacent > 0)
    content = (
      <span className="tabular-nums [text-box-trim:trim-both] [text-box-edge:cap_alphabetic]">
        {cell.adjacent}
      </span>
    );

  return (
    <div
      className={cn(
        "grid size-6 min-h-0 min-w-0 place-items-center p-0 text-[0.65rem] font-bold leading-none select-none",
        cell.revealed
          ? [
              "border border-foreground/10 bg-background",
              cell.isMine && "bg-destructive/15 text-destructive",
              !cell.isMine && cell.adjacent > 0 && NUMBER_COLORS[cell.adjacent],
            ]
          : [
              "border-2 bg-[hsl(220,14%,80%)] dark:bg-[hsl(220,10%,32%)]",
              "border-t-[hsl(220,14%,92%)] border-l-[hsl(220,14%,92%)] border-b-[hsl(220,14%,58%)] border-r-[hsl(220,14%,58%)]",
              "dark:border-t-[hsl(220,10%,44%)] dark:border-l-[hsl(220,10%,44%)] dark:border-b-[hsl(220,10%,18%)] dark:border-r-[hsl(220,10%,18%)]",
            ],
        highlight === "clue" && "relative z-10 ring-2 ring-inset ring-ring",
        highlight === "clue-a" && cn("relative z-10 ring-2 ring-inset", HINT_CLUE_A_RING),
        highlight === "clue-b" && cn("relative z-10 ring-2 ring-inset", HINT_CLUE_B_RING),
        highlight === "scope" && cn("relative z-10", HINT_SCOPE_SURFACE),
        highlight === "focus" &&
          "relative z-10 ring-2 ring-inset ring-amber-500 dark:ring-amber-400",
      )}
      aria-hidden
    >
      {content}
    </div>
  );
}

export function HintRegionPreview({ game, hint }: { game: GameState; hint: Hint }) {
  const { r0, c0, r1, c1 } = hintBounds(hint, game.rows, game.cols);
  const roleByKey = new Map<string, HintRole>();
  for (const hc of hint.cells) {
    roleByKey.set(`${hc.row},${hc.col}`, hc.role);
  }
  const h = r1 - r0 + 1;
  const w = c1 - c0 + 1;

  const cells = [];
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const cell = cellAt(game, row, col);
      const highlight = roleByKey.get(`${row},${col}`);
      cells.push(<PreviewCell key={`${row}-${col}`} cell={cell} highlight={highlight} />);
    }
  }

  return (
    <div
      className="grid w-fit overflow-hidden rounded-md bg-muted/50"
      style={{
        gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${h}, minmax(0, 1fr))`,
        width: `min(100%, ${w * 28}px)`,
      }}
      aria-hidden
    >
      {cells}
    </div>
  );
}
