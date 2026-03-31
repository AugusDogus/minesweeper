import { expect, test } from "vite-plus/test";
import type { Cell, GameState } from "./game.ts";
import {
  autoFlagNeighbors,
  canAutoFlagNeighbors,
  canChordReveal,
  chordReveal,
  cloneGameState,
  createGame,
  describeLocalFlagContradictions,
  DIFFICULTIES,
  isRevealable,
  reveal,
} from "./game.ts";

function emptyCell(): Cell {
  return { isMine: false, adjacent: 0, revealed: false, flagged: false };
}

test("first reveal places mines and plays", () => {
  const g = createGame(DIFFICULTIES[0]!);
  reveal(g, 0, 0);
  expect(g.started).toBe(true);
  expect(g.status).not.toBe("idle");
  expect(g.cells.some((c) => c.isMine)).toBe(true);
});

test("cloneGameState is independent of original", () => {
  const g = createGame(DIFFICULTIES[0]!);
  reveal(g, 0, 0);
  const copy = cloneGameState(g);
  copy.cells[0]!.revealed = false;
  expect(g.cells[0]!.revealed).toBe(true);
});

test("isRevealable matches reveal no-op rules", () => {
  const g = createGame(DIFFICULTIES[0]!);
  expect(isRevealable(g, 0, 0)).toBe(true);
  reveal(g, 0, 0);
  expect(isRevealable(g, 0, 0)).toBe(false);
});

test("describeLocalFlagContradictions detects too many flags next to a clue", () => {
  const cells: Cell[] = Array.from({ length: 9 }, () => emptyCell());
  cells[4] = { isMine: false, adjacent: 1, revealed: true, flagged: false };
  cells[0] = { ...emptyCell(), flagged: true };
  cells[1] = { ...emptyCell(), flagged: true };
  const g: GameState = {
    rows: 3,
    cols: 3,
    mineTotal: 1,
    cells,
    status: "playing",
    started: true,
    elapsedSeconds: 0,
  };
  const msg = describeLocalFlagContradictions(g);
  expect(msg).not.toBeNull();
  expect(msg).toContain("Too many flags");
});

test("describeLocalFlagContradictions detects not enough hidden neighbors for remaining mines", () => {
  const cells: Cell[] = Array.from({ length: 9 }, () => emptyCell());
  // Corner clue 3 with only one hidden neighbor left (two neighbors revealed empty).
  cells[0] = { isMine: false, adjacent: 3, revealed: true, flagged: false };
  cells[1] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  cells[3] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  // (1,1) index 4 is sole hidden neighbor of (0,0)
  const g: GameState = {
    rows: 3,
    cols: 3,
    mineTotal: 1,
    cells,
    status: "playing",
    started: true,
    elapsedSeconds: 0,
  };
  const msg = describeLocalFlagContradictions(g);
  expect(msg).not.toBeNull();
  expect(msg).toContain("still needs");
});

test("chordReveal opens remaining neighbors when flag count matches the clue", () => {
  const cells: Cell[] = Array.from({ length: 9 }, () => emptyCell());
  cells[4] = { isMine: false, adjacent: 1, revealed: true, flagged: false };
  cells[0] = { isMine: true, adjacent: 0, revealed: false, flagged: true };
  const g: GameState = {
    rows: 3,
    cols: 3,
    mineTotal: 1,
    cells,
    status: "playing",
    started: true,
    elapsedSeconds: 0,
  };
  expect(canChordReveal(g, 1, 1)).toBe(true);
  expect(chordReveal(g, 1, 1)).toBe(true);
  expect(g.cells[1]!.revealed).toBe(true);
  expect(g.cells[8]!.revealed).toBe(true);
});

test("autoFlagNeighbors marks all hidden neighbors when the clue fully determines them", () => {
  const cells: Cell[] = Array.from({ length: 9 }, () => emptyCell());
  cells[0] = { isMine: false, adjacent: 3, revealed: true, flagged: false };
  cells[1] = { ...emptyCell() };
  cells[3] = { ...emptyCell() };
  cells[4] = { ...emptyCell() };
  cells[2] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  cells[5] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  cells[6] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  cells[7] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  cells[8] = { isMine: false, adjacent: 0, revealed: true, flagged: false };
  const g: GameState = {
    rows: 3,
    cols: 3,
    mineTotal: 3,
    cells,
    status: "playing",
    started: true,
    elapsedSeconds: 0,
  };
  expect(canAutoFlagNeighbors(g, 0, 0)).toBe(true);
  expect(autoFlagNeighbors(g, 0, 0)).toBe(true);
  expect(g.cells[1]!.flagged).toBe(true);
  expect(g.cells[3]!.flagged).toBe(true);
  expect(g.cells[4]!.flagged).toBe(true);
});
