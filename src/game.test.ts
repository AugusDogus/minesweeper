import { expect, test } from "vite-plus/test";
import { createGame, DIFFICULTIES, reveal } from "./game.ts";

test("first reveal places mines and plays", () => {
  const g = createGame(DIFFICULTIES[0]!);
  reveal(g, 0, 0);
  expect(g.started).toBe(true);
  expect(g.status).not.toBe("idle");
  expect(g.cells.some((c) => c.isMine)).toBe(true);
});
