import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";

import type { BoardInteraction } from "@/components/board/use-board-animations.ts";
import { HintExplanation } from "@/components/hint-explanation.tsx";
import { FlagContradictionPreview, HintRegionPreview } from "@/components/hint-region-preview.tsx";
import { AppShell } from "@/components/shell/app-shell.tsx";
import { GameScreen } from "@/components/shell/game-screen.tsx";
import { MenuScreen } from "@/components/shell/menu-screen.tsx";
import { SettingsSheet } from "@/components/shell/settings-sheet.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import {
  autoFlagNeighbors,
  canAutoFlagNeighbors,
  canChordReveal,
  chordReveal,
  cloneGameState,
  createGame,
  DIFFICULTIES,
  findDifficultyForGame,
  flagCount,
  getLocalFlagContradiction,
  hasGameChanged,
  isRevealable,
  NO_FORCED_MOVE_HINT,
  reveal,
  tickTimer,
  toggleFlag,
  type Difficulty,
  type GameState,
  type LocalFlagContradiction,
} from "@/game.ts";
import { findHint, getHintNarrative, type Hint, type HintRole } from "@/hints.ts";
import { createDefaultSettings, sanitizeSettings, type GameSettings } from "@/lib/game-settings.ts";
import {
  clearStoredGame,
  isResumableGame,
  readStoredDifficulty,
  readStoredGame,
  readStoredSettings,
  snapshotGame,
  writeStoredDifficulty,
  writeStoredGame,
  writeStoredSettings,
} from "@/lib/persistence.ts";
import { type ThemeName } from "@/lib/themes.ts";
import { applyThemeToDocument, useThemePreference } from "@/use-theme.ts";

type ShellViewMode = "menu" | "playing" | "post_game";

function useInitialSettings(): GameSettings {
  return useMemo(() => sanitizeSettings(readStoredSettings(), createDefaultSettings()), []);
}

function formatIdleHelp(): string {
  return "Reveal a cell first. Pattern help works once the board is in progress.";
}

export default function App() {
  const initialSettings = useInitialSettings();
  const [settings, setSettings] = useState<GameSettings>(initialSettings);
  const { themeName, setThemeName } = useThemePreference(initialSettings.themeName);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(() =>
    readStoredDifficulty(),
  );
  const [savedGame, setSavedGame] = useState<GameState | null>(() => readStoredGame());
  const [game, setGame] = useState<GameState | null>(null);
  const [viewMode, setViewMode] = useState<ShellViewMode>("menu");
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeHint, setActiveHint] = useState<Hint | null>(null);
  const [flagContradiction, setFlagContradiction] = useState<LocalFlagContradiction | null>(null);
  const [helpBanner, setHelpBanner] = useState<string | null>(null);
  const [lastInteraction, setLastInteraction] = useState<BoardInteraction>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const undoStackRef = useRef<GameState[]>([]);
  const redoStackRef = useRef<GameState[]>([]);
  const highlightClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const gameRef = useRef<GameState | null>(game);
  const activeHintRef = useRef<Hint | null>(activeHint);
  gameRef.current = game;
  activeHintRef.current = activeHint;

  const { trigger: triggerHaptic, isSupported: hapticsSupported } = useWebHaptics();

  const triggerTouchHaptic = useCallback(
    (preset: "success" | "error" | "selection" | "light") => {
      if (!settings.hapticsEnabled || !hapticsSupported || typeof window === "undefined") return;
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      void triggerHaptic(preset);
    },
    [hapticsSupported, settings.hapticsEnabled, triggerHaptic],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      const current = gameRef.current;
      if (!current || current.status !== "playing") return;
      const next = cloneGameState(current);
      tickTimer(next, 1);
      setGame(next);
      gameRef.current = next;
      if (isResumableGame(next)) {
        const snapshot = snapshotGame(next);
        writeStoredGame(snapshot);
        setSavedGame(snapshot);
      }
    }, 1000);
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  const cancelHighlightClear = useCallback(() => {
    if (highlightClearTimeoutRef.current !== undefined) {
      clearTimeout(highlightClearTimeoutRef.current);
      highlightClearTimeoutRef.current = undefined;
    }
  }, []);

  const scheduleHighlightClear = useCallback(() => {
    cancelHighlightClear();
    highlightClearTimeoutRef.current = setTimeout(() => {
      setActiveHint(null);
      setFlagContradiction(null);
      highlightClearTimeoutRef.current = undefined;
    }, 3000);
  }, [cancelHighlightClear]);

  const clearHintFully = useCallback(() => {
    cancelHighlightClear();
    setActiveHint(null);
    setFlagContradiction(null);
    setHelpDialogOpen(false);
  }, [cancelHighlightClear]);

  useEffect(() => () => cancelHighlightClear(), [cancelHighlightClear]);

  const persistSettings = useCallback(
    (nextSettings: GameSettings) => {
      writeStoredSettings(nextSettings);
      applyThemeToDocument(nextSettings.themeName);
      setThemeName(nextSettings.themeName);
    },
    [setThemeName],
  );

  const updateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      setSettings((current) => {
        const next = sanitizeSettings({ ...current, ...patch }, current);
        persistSettings(next);
        return next;
      });
    },
    [persistSettings],
  );

  const setTheme = useCallback(
    (nextThemeName: ThemeName) => {
      updateSettings({ themeName: nextThemeName });
    },
    [updateSettings],
  );

  const updatePersistenceForGame = useCallback((nextGame: GameState | null) => {
    if (!nextGame || !isResumableGame(nextGame)) {
      clearStoredGame();
      setSavedGame(null);
      return;
    }
    const snapshot = snapshotGame(nextGame);
    writeStoredGame(snapshot);
    setSavedGame(snapshot);
  }, []);

  const commitGame = useCallback(
    (nextGame: GameState | null, interaction: BoardInteraction = null) => {
      setGame(nextGame);
      gameRef.current = nextGame;
      setLastInteraction(interaction);

      if (!nextGame) {
        stopTimer();
        startTransition(() => setViewMode("menu"));
        return;
      }

      const difficulty = findDifficultyForGame(nextGame);
      if (difficulty) {
        setSelectedDifficulty(difficulty);
        writeStoredDifficulty(difficulty);
      }

      if (nextGame.status === "playing") {
        if (nextGame.started) startTimer();
        startTransition(() => setViewMode("playing"));
      } else if (nextGame.status === "won" || nextGame.status === "lost") {
        stopTimer();
        clearStoredGame();
        setSavedGame(null);
        startTransition(() => setViewMode("post_game"));
      } else {
        stopTimer();
        startTransition(() => setViewMode("playing"));
      }

      updatePersistenceForGame(nextGame);
    },
    [startTimer, stopTimer, updatePersistenceForGame],
  );

  const handleDifficultyChange = useCallback((difficulty: Difficulty) => {
    setSelectedDifficulty(difficulty);
    writeStoredDifficulty(difficulty);
  }, []);

  const handleNewGame = useCallback(
    (difficulty = selectedDifficulty) => {
      stopTimer();
      clearHintFully();
      setHelpBanner(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      handleDifficultyChange(difficulty);
      commitGame(createGame(difficulty), null);
    },
    [clearHintFully, commitGame, handleDifficultyChange, selectedDifficulty, stopTimer],
  );

  const handleResume = useCallback(() => {
    if (!savedGame) return;
    clearHintFully();
    setHelpBanner(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    commitGame(cloneGameState(savedGame), null);
  }, [clearHintFully, commitGame, savedGame]);

  const pushUndoSnapshot = useCallback((snapshot: GameState) => {
    undoStackRef.current.push(snapshot);
    redoStackRef.current = [];
  }, []);

  const withGameMutation = useCallback(
    (
      row: number,
      col: number,
      kind: NonNullable<BoardInteraction>["kind"],
      mutate: (draft: GameState) => boolean,
      hapticForChange: "success" | "error" | "selection" | "light" = "selection",
    ) => {
      const current = gameRef.current;
      if (!current) return;
      const previous = cloneGameState(current);
      const draft = cloneGameState(current);
      clearHintFully();
      setHelpBanner(null);
      const changed = mutate(draft);
      if (!changed || !hasGameChanged(previous, draft)) return;

      pushUndoSnapshot(previous);
      if (draft.status === "lost") {
        triggerTouchHaptic("error");
      } else if (draft.status === "won") {
        triggerTouchHaptic("success");
      } else {
        triggerTouchHaptic(hapticForChange);
      }

      commitGame(draft, {
        token: Date.now(),
        row,
        col,
        kind,
      });
    },
    [clearHintFully, commitGame, pushUndoSnapshot, triggerTouchHaptic],
  );

  const handlePrimaryAction = useCallback(
    (row: number, col: number) => {
      withGameMutation(
        row,
        col,
        "primary",
        (draft) => {
          if (isRevealable(draft, row, col)) {
            reveal(draft, row, col);
            return true;
          }
          if (settings.easyDigging && canChordReveal(draft, row, col)) {
            return chordReveal(draft, row, col);
          }
          return false;
        },
        settings.hapticIntensity === "medium" ? "selection" : "light",
      );
    },
    [settings.easyDigging, settings.hapticIntensity, withGameMutation],
  );

  const handleSecondaryAction = useCallback(
    (row: number, col: number) => {
      withGameMutation(
        row,
        col,
        "secondary",
        (draft) => {
          const index = row * draft.cols + col;
          const target = draft.cells[index]!;
          if (!target.revealed) {
            const before = target.flagged;
            toggleFlag(draft, row, col);
            return target.flagged !== before;
          }
          if (settings.easyFlagging && canAutoFlagNeighbors(draft, row, col)) {
            return autoFlagNeighbors(draft, row, col);
          }
          return false;
        },
        settings.hapticIntensity === "medium" ? "selection" : "light",
      );
    },
    [settings.easyFlagging, settings.hapticIntensity, withGameMutation],
  );

  const handleUndo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    const current = gameRef.current;
    if (!previous || !current) return;
    redoStackRef.current.push(cloneGameState(current));
    clearHintFully();
    setHelpBanner(null);
    commitGame(previous, null);
  }, [clearHintFully, commitGame]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    const current = gameRef.current;
    if (!next || !current) return;
    undoStackRef.current.push(cloneGameState(current));
    clearHintFully();
    setHelpBanner(null);
    commitGame(next, null);
  }, [clearHintFully, commitGame]);

  const dismissHintDialog = useCallback(() => {
    setHelpDialogOpen(false);
    if (activeHintRef.current || flagContradiction) {
      scheduleHighlightClear();
    }
  }, [flagContradiction, scheduleHighlightClear]);

  const handleHelp = useCallback(() => {
    const current = gameRef.current;
    if (helpDialogOpen) {
      dismissHintDialog();
      return;
    }
    if (activeHintRef.current) {
      cancelHighlightClear();
      setHelpDialogOpen(true);
      return;
    }
    if (!current) {
      setHelpDialogOpen(true);
      return;
    }
    if (current.status !== "playing") {
      setHelpBanner(
        current.status === "idle" ? formatIdleHelp() : "Start a new game to use pattern help.",
      );
      setHelpDialogOpen(true);
      return;
    }
    const contradiction = getLocalFlagContradiction(current);
    if (contradiction) {
      setFlagContradiction(contradiction);
      cancelHighlightClear();
      setActiveHint(null);
      setHelpDialogOpen(true);
      return;
    }
    const hint = findHint(current);
    if (!hint) {
      setHelpBanner(`No forced move is visible from the current clues. ${NO_FORCED_MOVE_HINT}`);
      setHelpDialogOpen(true);
      return;
    }
    cancelHighlightClear();
    setFlagContradiction(null);
    setActiveHint(hint);
    setHelpDialogOpen(true);
  }, [cancelHighlightClear, dismissHintDialog, helpDialogOpen]);

  const handleHome = useCallback(() => {
    const current = gameRef.current;
    if (current && isResumableGame(current)) {
      const snapshot = snapshotGame(current);
      writeStoredGame(snapshot);
      setSavedGame(snapshot);
    }
    stopTimer();
    clearHintFully();
    setHelpBanner(null);
    startTransition(() => setViewMode("menu"));
  }, [clearHintFully, stopTimer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const inEditable =
        (target instanceof HTMLElement && target.isContentEditable) ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (inEditable) return;
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || inEditable) return;
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        handleHelp();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleHelp, handleRedo, handleUndo]);

  const highlightByKey = useMemo(() => {
    const map = new Map<string, HintRole>();
    if (activeHint) {
      for (const cell of activeHint.cells) {
        map.set(`${cell.row},${cell.col}`, cell.role);
      }
    } else if (flagContradiction) {
      for (const cell of flagContradiction.highlightCells) {
        map.set(`${cell.row},${cell.col}`, cell.role);
      }
    }
    return map;
  }, [activeHint, flagContradiction]);

  const hintNarrative = game && activeHint ? getHintNarrative(game, activeHint) : null;
  const currentDifficulty = (game && findDifficultyForGame(game)) ?? selectedDifficulty;
  const minesRemaining = game
    ? Math.max(0, game.mineTotal - flagCount(game))
    : currentDifficulty.mines;

  return (
    <AppShell>
      <Dialog
        open={helpDialogOpen}
        onOpenChange={(open) => {
          if (!open) dismissHintDialog();
          else setHelpDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          {game && activeHint && hintNarrative ? (
            <>
              <DialogHeader>
                <DialogTitle>{hintNarrative.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <HintRegionPreview game={game} hint={activeHint} />
                <HintExplanation narrative={hintNarrative} />
              </div>
            </>
          ) : game && flagContradiction ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {flagContradiction.kind === "too_many_flags"
                    ? "Flag count mismatch"
                    : "Hidden squares mismatch"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <FlagContradictionPreview game={game} contradiction={flagContradiction} />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {flagContradiction.message}
                </p>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Pattern Help</DialogTitle>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {helpBanner ?? formatIdleHelp()}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <SettingsSheet
        open={settingsOpen}
        settings={settings}
        onOpenChange={setSettingsOpen}
        onSettingsChange={updateSettings}
        onThemeChange={setTheme}
      />

      {viewMode === "menu" ? (
        <MenuScreen
          difficulty={selectedDifficulty}
          difficulties={DIFFICULTIES}
          canResume={Boolean(savedGame && isResumableGame(savedGame))}
          themeName={themeName}
          onDifficultyChange={handleDifficultyChange}
          onNewGame={() => handleNewGame(selectedDifficulty)}
          onResume={handleResume}
          onHelp={handleHelp}
          onOpenSettings={() => setSettingsOpen(true)}
          onThemeChange={setTheme}
        />
      ) : game ? (
        <GameScreen
          game={game}
          difficulty={currentDifficulty}
          selectedDifficulty={selectedDifficulty}
          difficulties={DIFFICULTIES}
          settings={settings}
          themeName={themeName}
          minesRemaining={minesRemaining}
          helpBanner={helpBanner}
          highlights={highlightByKey}
          interaction={lastInteraction}
          onHome={handleHome}
          onHelp={handleHelp}
          onOpenSettings={() => setSettingsOpen(true)}
          onThemeChange={setTheme}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={handleSecondaryAction}
          onDifficultyChange={handleDifficultyChange}
          onNewGame={() => handleNewGame(selectedDifficulty)}
          onSettingsChange={updateSettings}
        />
      ) : (
        <MenuScreen
          difficulty={selectedDifficulty}
          difficulties={DIFFICULTIES}
          canResume={Boolean(savedGame && isResumableGame(savedGame))}
          themeName={themeName}
          onDifficultyChange={handleDifficultyChange}
          onNewGame={() => handleNewGame(selectedDifficulty)}
          onResume={handleResume}
          onHelp={handleHelp}
          onOpenSettings={() => setSettingsOpen(true)}
          onThemeChange={setTheme}
        />
      )}
    </AppShell>
  );
}
