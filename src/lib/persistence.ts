import type { Difficulty, GameState } from "@/game.ts";
import { cloneGameState, DIFFICULTIES } from "@/game.ts";
import { createDefaultSettings, sanitizeSettings, type GameSettings } from "@/lib/game-settings.ts";
import type { ThemeName } from "@/lib/themes.ts";

export type SerializedGame = GameState;

export const STORAGE_KEYS = {
  settings: "minesweeper-shell-settings",
  unfinishedGame: "minesweeper-unfinished-game",
  lastSelectedDifficulty: "minesweeper-last-selected-difficulty",
  theme: "minesweeper-shell-theme",
} as const;

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readStoredThemeName(): ThemeName | null {
  const raw = readStorage(STORAGE_KEYS.theme);
  if (
    raw === "classic-light" ||
    raw === "classic-dark" ||
    raw === "warm-paper" ||
    raw === "amoled"
  ) {
    return raw;
  }
  return null;
}

export function writeStoredThemeName(themeName: ThemeName): void {
  writeStorage(STORAGE_KEYS.theme, themeName);
}

export function readStoredDifficulty(): Difficulty {
  const id = readStorage(STORAGE_KEYS.lastSelectedDifficulty);
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[1]!;
}

export function writeStoredDifficulty(difficulty: Difficulty): void {
  writeStorage(STORAGE_KEYS.lastSelectedDifficulty, difficulty.id);
}

export function readStoredSettings(): GameSettings {
  return sanitizeSettings(
    safeParse<Partial<GameSettings>>(readStorage(STORAGE_KEYS.settings)),
    createDefaultSettings(),
  );
}

export function writeStoredSettings(settings: GameSettings): void {
  writeStorage(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function isCellLike(value: unknown): value is SerializedGame["cells"][number] {
  if (!value || typeof value !== "object") return false;
  const cell = value as Record<string, unknown>;
  return (
    typeof cell.isMine === "boolean" &&
    typeof cell.adjacent === "number" &&
    typeof cell.revealed === "boolean" &&
    typeof cell.flagged === "boolean"
  );
}

function isSerializedGame(value: unknown): value is SerializedGame {
  if (!value || typeof value !== "object") return false;
  const game = value as Record<string, unknown>;
  return (
    typeof game.rows === "number" &&
    typeof game.cols === "number" &&
    typeof game.mineTotal === "number" &&
    Array.isArray(game.cells) &&
    game.cells.every(isCellLike) &&
    (game.status === "idle" ||
      game.status === "playing" ||
      game.status === "won" ||
      game.status === "lost") &&
    typeof game.started === "boolean" &&
    typeof game.elapsedSeconds === "number"
  );
}

export function isResumableGame(game: SerializedGame | null): game is SerializedGame {
  return Boolean(game && game.started && game.status === "playing");
}

export function readStoredGame(): SerializedGame | null {
  const parsed = safeParse<unknown>(readStorage(STORAGE_KEYS.unfinishedGame));
  return isSerializedGame(parsed) ? parsed : null;
}

export function writeStoredGame(game: SerializedGame): void {
  writeStorage(STORAGE_KEYS.unfinishedGame, JSON.stringify(game));
}

export function clearStoredGame(): void {
  removeStorage(STORAGE_KEYS.unfinishedGame);
}

export function snapshotGame(game: GameState): SerializedGame {
  return cloneGameState(game);
}
