import { getSystemThemeName, type ThemeName } from "@/lib/themes.ts";

export type ActionMode = "reveal" | "flag";

export type GameSettings = {
  themeName: ThemeName;
  defaultAction: ActionMode;
  showActionToggle: boolean;
  longPressEnabled: boolean;
  longPressMs: number;
  easyDigging: boolean;
  easyFlagging: boolean;
  animationSpeed: number;
  cellBorders: boolean;
  hapticsEnabled: boolean;
  hapticIntensity: "light" | "medium";
};

export function createDefaultSettings(): GameSettings {
  return {
    themeName: getSystemThemeName(),
    defaultAction: "reveal",
    showActionToggle: true,
    longPressEnabled: true,
    longPressMs: 325,
    easyDigging: false,
    easyFlagging: false,
    animationSpeed: 1,
    cellBorders: true,
    hapticsEnabled: true,
    hapticIntensity: "light",
  };
}

export function sanitizeSettings(
  input: Partial<GameSettings> | null | undefined,
  defaults: GameSettings = createDefaultSettings(),
): GameSettings {
  const next: GameSettings = {
    themeName: input?.themeName ?? defaults.themeName,
    defaultAction: input?.defaultAction === "flag" ? "flag" : "reveal",
    showActionToggle: input?.showActionToggle ?? defaults.showActionToggle,
    longPressEnabled: input?.longPressEnabled ?? defaults.longPressEnabled,
    longPressMs: Math.min(
      700,
      Math.max(200, Math.round(input?.longPressMs ?? defaults.longPressMs)),
    ),
    easyDigging: input?.easyDigging ?? defaults.easyDigging,
    easyFlagging: input?.easyFlagging ?? defaults.easyFlagging,
    animationSpeed: Math.min(
      1.75,
      Math.max(0, Number(input?.animationSpeed ?? defaults.animationSpeed)),
    ),
    cellBorders: input?.cellBorders ?? defaults.cellBorders,
    hapticsEnabled: input?.hapticsEnabled ?? defaults.hapticsEnabled,
    hapticIntensity: input?.hapticIntensity === "medium" ? "medium" : "light",
  };

  if (!next.longPressEnabled) {
    next.showActionToggle = true;
  }

  return next;
}
