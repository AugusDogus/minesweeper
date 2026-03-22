import { expect, test } from "vite-plus/test";

import type { Cell, GameState } from "./game.ts";
import { findHint } from "./hints.ts";

function stateFromCells(
  rows: number,
  cols: number,
  cells: Cell[],
  mineTotal: number,
  gameStatus: GameState["status"] = "playing",
): GameState {
  return {
    rows,
    cols,
    mineTotal,
    cells,
    status: gameStatus,
    started: true,
    elapsedSeconds: 0,
  };
}

test("returns null when no revealed clues", () => {
  const cells: Cell[] = [
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
  ];
  const s = stateFromCells(2, 2, cells, 0);
  expect(findHint(s)).toBeNull();
});

test("basic counting: all remaining neighbors are mines", () => {
  const cells: Cell[] = [
    { isMine: true, adjacent: 0, revealed: false, flagged: false },
    { isMine: true, adjacent: 0, revealed: false, flagged: false },
    { isMine: true, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 3, revealed: true, flagged: false },
  ];
  const s = stateFromCells(2, 2, cells, 3);
  const h = findHint(s);
  expect(h).not.toBeNull();
  expect(h!.patternId).toBe("basic-mines");
  expect(h!.cells.some((c) => c.role === "clue" && c.row === 1 && c.col === 1)).toBe(true);
  expect(h!.cells.filter((c) => c.role === "focus")).toHaveLength(3);
});

test("prefers basic counting over subset when one clue already fixes the move", () => {
  const cells: Cell[] = Array.from({ length: 12 }, () => ({
    isMine: false,
    adjacent: 0,
    revealed: true,
    flagged: false,
  }));
  const set = (r: number, c: number, patch: Partial<Cell>) => {
    cells[r * 4 + c] = { ...cells[r * 4 + c]!, ...patch };
  };
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      set(r, c, { revealed: true, adjacent: 0, isMine: false });
    }
  }
  set(0, 1, { revealed: false });
  set(0, 2, { revealed: false });
  set(1, 0, { revealed: true, adjacent: 1, isMine: false });
  set(1, 2, { revealed: true, adjacent: 2, isMine: false });
  set(0, 0, { revealed: true, adjacent: 0 });
  set(1, 1, { revealed: true, adjacent: 0 });
  set(2, 0, { revealed: true, adjacent: 0 });
  set(2, 1, { revealed: true, adjacent: 0 });
  set(0, 3, { revealed: true, adjacent: 0 });
  set(1, 3, { revealed: true, adjacent: 0 });
  set(2, 2, { revealed: true, adjacent: 0 });
  set(2, 3, { revealed: true, adjacent: 0 });

  const g = stateFromCells(3, 4, cells, 5);
  const h = findHint(g);
  expect(h).not.toBeNull();
  expect(h!.patternId).toBe("basic-mines");
  expect(h!.cells.some((c) => c.role === "clue" && c.row === 1 && c.col === 0)).toBe(true);
  expect(h!.cells.some((c) => c.role === "focus" && c.row === 0 && c.col === 1)).toBe(true);
});

test("subset rule: remainder region is all mines", () => {
  const cells: Cell[] = Array.from({ length: 12 }, () => ({
    isMine: false,
    adjacent: 0,
    revealed: true,
    flagged: false,
  }));
  const set = (r: number, c: number, patch: Partial<Cell>) => {
    cells[r * 4 + c] = { ...cells[r * 4 + c]!, ...patch };
  };
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      set(r, c, { revealed: true, adjacent: 0, isMine: false });
    }
  }
  set(0, 1, { revealed: false });
  set(0, 2, { revealed: false });
  set(1, 1, { revealed: false });
  set(1, 0, { revealed: true, adjacent: 1, isMine: false });
  set(1, 2, { revealed: true, adjacent: 2, isMine: false });
  set(0, 0, { revealed: true, adjacent: 0 });
  set(2, 0, { revealed: true, adjacent: 0 });
  set(2, 1, { revealed: true, adjacent: 0 });
  set(0, 3, { revealed: true, adjacent: 0 });
  set(1, 3, { revealed: true, adjacent: 0 });
  set(2, 2, { revealed: true, adjacent: 0 });
  set(2, 3, { revealed: true, adjacent: 0 });

  const g = stateFromCells(3, 4, cells, 5);
  const h = findHint(g);
  expect(h).not.toBeNull();
  expect(h!.patternId).toBe("subset-mines");
  expect(h!.cells.some((x) => x.role === "focus" && x.row === 0 && x.col === 2)).toBe(true);
  expect(h!.cells.filter((c) => c.role === "clue-a" || c.role === "clue-b")).toHaveLength(2);
});

test("1–2–1 row names the pattern when subset applies on that triple", () => {
  const cells: Cell[] = Array.from({ length: 9 }, () => ({
    isMine: false,
    adjacent: 0,
    revealed: true,
    flagged: false,
  }));
  const set = (r: number, c: number, patch: Partial<Cell>) => {
    cells[r * 3 + c] = { ...cells[r * 3 + c]!, ...patch };
  };
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      set(r, c, { revealed: true, adjacent: 0, isMine: false });
    }
  }
  set(1, 0, { revealed: true, adjacent: 1, isMine: false });
  set(1, 1, { revealed: true, adjacent: 2, isMine: false });
  set(1, 2, { revealed: true, adjacent: 1, isMine: false });
  set(0, 0, { revealed: false });
  set(0, 1, { revealed: false });
  set(0, 2, { revealed: false });
  set(2, 0, { revealed: true, adjacent: 0 });
  set(2, 1, { revealed: true, adjacent: 0 });
  set(2, 2, { revealed: true, adjacent: 0 });

  const g = stateFromCells(3, 3, cells, 2);
  const h = findHint(g);
  expect(h).not.toBeNull();
  expect(h!.patternId).toBe("one-two-one");
});

test("non-playing status returns null", () => {
  const cells: Cell[] = [
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 0, revealed: false, flagged: false },
    { isMine: false, adjacent: 3, revealed: true, flagged: false },
  ];
  const s = stateFromCells(2, 2, cells, 3, "idle");
  expect(findHint(s)).toBeNull();
});
