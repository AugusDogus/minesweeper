import { expect, test } from "vite-plus/test";

import { diffBoard } from "@/components/board/board-diff.ts";
import type { Cell, GameState } from "@/game.ts";

function emptyCell(): Cell {
  return { isMine: false, adjacent: 0, revealed: false, flagged: false };
}

function makeState(cells: Cell[], status: GameState["status"] = "playing"): GameState {
  return {
    rows: 2,
    cols: 2,
    mineTotal: 1,
    cells,
    status,
    started: true,
    elapsedSeconds: 0,
  };
}

test("diffBoard categorizes reveal, flag, and wrong-flag states", () => {
  const previous = makeState([
    emptyCell(),
    emptyCell(),
    emptyCell(),
    { isMine: false, adjacent: 1, revealed: false, flagged: true },
  ]);
  const next = makeState(
    [
      { isMine: false, adjacent: 0, revealed: true, flagged: false },
      { isMine: true, adjacent: 0, revealed: true, flagged: false },
      { isMine: false, adjacent: 1, revealed: false, flagged: true },
      { isMine: false, adjacent: 1, revealed: false, flagged: true },
    ],
    "lost",
  );

  const changes = diffBoard(previous, next);
  expect(changes).toEqual(
    expect.arrayContaining([
      { row: 0, col: 0, kind: "revealed" },
      { row: 0, col: 1, kind: "exploded" },
      { row: 1, col: 0, kind: "flagged" },
      { row: 1, col: 1, kind: "wrongFlag" },
    ]),
  );
});
