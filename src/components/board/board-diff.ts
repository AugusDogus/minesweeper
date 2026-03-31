import type { GameState } from "@/game.ts";

export type BoardCellChangeKind =
  | "revealed"
  | "flagged"
  | "unflagged"
  | "exploded"
  | "wrongFlag"
  | "wonAutoFlag";

export type BoardCellChange = {
  readonly row: number;
  readonly col: number;
  readonly kind: BoardCellChangeKind;
};

export function diffBoard(previous: GameState, next: GameState): BoardCellChange[] {
  const changes: BoardCellChange[] = [];

  for (let row = 0; row < next.rows; row++) {
    for (let col = 0; col < next.cols; col++) {
      const index = row * next.cols + col;
      const before = previous.cells[index]!;
      const after = next.cells[index]!;

      if (!before.revealed && after.revealed) {
        changes.push({
          row,
          col,
          kind: after.isMine ? "exploded" : "revealed",
        });
      }

      if (!before.flagged && after.flagged) {
        changes.push({
          row,
          col,
          kind: next.status === "won" && after.isMine ? "wonAutoFlag" : "flagged",
        });
      }

      if (before.flagged && !after.flagged) {
        changes.push({ row, col, kind: "unflagged" });
      }

      if (next.status === "lost" && after.flagged && !after.isMine) {
        changes.push({ row, col, kind: "wrongFlag" });
      }
    }
  }

  return changes;
}
