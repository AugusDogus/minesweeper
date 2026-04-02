import { afterEach, expect, test } from "vite-plus/test";

import {
  clearStoredGame,
  isResumableGame,
  readStoredDifficulty,
  readStoredGame,
  readStoredSettings,
  writeStoredDifficulty,
  writeStoredGame,
  writeStoredSettings,
} from "@/lib/persistence.ts";
import type { Cell, GameState } from "@/game.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: storage,
    matchMedia: () => ({ matches: false }),
  },
  configurable: true,
});

function emptyCell(): Cell {
  return { isMine: false, adjacent: 0, revealed: false, flagged: false };
}

afterEach(() => {
  storage.clear();
});

test("settings persistence round-trips and forces action toggle when long press is disabled", () => {
  writeStoredSettings({
    ...readStoredSettings(),
    longPressEnabled: false,
    showActionToggle: false,
    animationSpeed: 1.5,
  });
  const next = readStoredSettings();
  expect(next.longPressEnabled).toBe(false);
  expect(next.showActionToggle).toBe(true);
  expect(next.animationSpeed).toBe(1.5);
});

test("unfinished game persistence only resumes started in-progress games", () => {
  const game: GameState = {
    rows: 2,
    cols: 2,
    mineTotal: 1,
    cells: [emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    status: "playing",
    started: true,
    elapsedSeconds: 9,
  };
  writeStoredGame(game);
  expect(readStoredGame()).toEqual(game);
  expect(isResumableGame(readStoredGame())).toBe(true);
  clearStoredGame();
  expect(readStoredGame()).toBeNull();
});

test("difficulty selection persistence round-trips", () => {
  const before = readStoredDifficulty();
  writeStoredDifficulty(before);
  expect(readStoredDifficulty().id).toBe(before.id);
});
