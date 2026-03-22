import { expect, test } from "vite-plus/test";
import { cloneGameState, createGame, DIFFICULTIES, isRevealable, reveal } from "./game.ts";

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
