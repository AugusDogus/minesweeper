import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import type { GameSettings } from "@/lib/game-settings.ts";
import { THEME_OPTIONS, type ThemeName } from "@/lib/themes.ts";

export function SettingsSheet({
  open,
  settings,
  onOpenChange,
  onSettingsChange,
  onThemeChange,
}: {
  open: boolean;
  settings: GameSettings;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (patch: Partial<GameSettings>) => void;
  onThemeChange: (themeName: ThemeName) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-1/2 max-h-[85svh] w-full max-w-[min(100%,30rem)] -translate-x-1/2 translate-y-0 rounded-b-none rounded-t-[1.75rem] border-x-0 border-b-0 p-0"
      >
        <div className="settings-sheet">
          <div className="settings-sheet__grabber" aria-hidden />
          <DialogHeader>
            <DialogTitle>Game Settings</DialogTitle>
          </DialogHeader>

          <section className="settings-sheet__section">
            <p className="settings-sheet__label">Theme</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  className={
                    theme.name === settings.themeName
                      ? "settings-chip settings-chip--active"
                      : "settings-chip"
                  }
                  onClick={() => onThemeChange(theme.name)}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings-sheet__section">
            <label className="settings-row">
              <span>Show action toggle</span>
              <input
                type="checkbox"
                checked={settings.showActionToggle}
                onChange={(event) => onSettingsChange({ showActionToggle: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>Long press</span>
              <input
                type="checkbox"
                checked={settings.longPressEnabled}
                onChange={(event) => onSettingsChange({ longPressEnabled: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>Easy digging</span>
              <input
                type="checkbox"
                checked={settings.easyDigging}
                onChange={(event) => onSettingsChange({ easyDigging: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>Easy flagging</span>
              <input
                type="checkbox"
                checked={settings.easyFlagging}
                onChange={(event) => onSettingsChange({ easyFlagging: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>Cell borders</span>
              <input
                type="checkbox"
                checked={settings.cellBorders}
                onChange={(event) => onSettingsChange({ cellBorders: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              <span>Haptics</span>
              <input
                type="checkbox"
                checked={settings.hapticsEnabled}
                onChange={(event) => onSettingsChange({ hapticsEnabled: event.target.checked })}
              />
            </label>
          </section>

          <section className="settings-sheet__section">
            <p className="settings-sheet__label">Default tap action</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={
                  settings.defaultAction === "reveal"
                    ? "settings-chip settings-chip--active"
                    : "settings-chip"
                }
                onClick={() => onSettingsChange({ defaultAction: "reveal" })}
              >
                Reveal
              </button>
              <button
                type="button"
                className={
                  settings.defaultAction === "flag"
                    ? "settings-chip settings-chip--active"
                    : "settings-chip"
                }
                onClick={() => onSettingsChange({ defaultAction: "flag" })}
              >
                Flag
              </button>
            </div>
          </section>

          <section className="settings-sheet__section">
            <label className="settings-slider">
              <span>Long press delay</span>
              <input
                type="range"
                min="200"
                max="700"
                step="25"
                value={settings.longPressMs}
                onChange={(event) => onSettingsChange({ longPressMs: Number(event.target.value) })}
              />
              <strong>{settings.longPressMs}ms</strong>
            </label>
            <label className="settings-slider">
              <span>Animation speed</span>
              <input
                type="range"
                min="0"
                max="1.75"
                step="0.25"
                value={settings.animationSpeed}
                onChange={(event) =>
                  onSettingsChange({ animationSpeed: Number(event.target.value) })
                }
              />
              <strong>
                {settings.animationSpeed === 0 ? "Off" : `${settings.animationSpeed.toFixed(2)}x`}
              </strong>
            </label>
            <label className="settings-slider">
              <span>Haptic intensity</span>
              <div className="grid grid-cols-2 gap-2">
                {(["light", "medium"] as const).map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    className={
                      settings.hapticIntensity === intensity
                        ? "settings-chip settings-chip--active"
                        : "settings-chip"
                    }
                    onClick={() => onSettingsChange({ hapticIntensity: intensity })}
                  >
                    {intensity === "light" ? "Light" : "Medium"}
                  </button>
                ))}
              </div>
            </label>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
