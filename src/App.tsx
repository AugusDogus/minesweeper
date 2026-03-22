import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebHaptics } from "web-haptics/react";
import {
  CircleHelp,
  Flag,
  Frown,
  Monitor,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Timer,
} from "lucide-react";

import { HintExplanation } from "@/components/hint-explanation.tsx";
import { FlagContradictionPreview, HintRegionPreview } from "@/components/hint-region-preview.tsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HINT_CLUE_A_RING, HINT_CLUE_B_RING, HINT_SCOPE_SURFACE } from "@/lib/hint-clue-rings.ts";
import { cn } from "@/lib/utils";

import { type Hint, type HintRole, findHint, getHintNarrative } from "./hints.ts";
import { type ThemePreference, useThemePreference } from "./use-theme.ts";

import {
  type Cell,
  type Difficulty,
  DIFFICULTIES,
  type GameState,
  cloneGameState,
  createGame,
  NO_FORCED_MOVE_HINT,
  type LocalFlagContradiction,
  getLocalFlagContradiction,
  flagCount,
  isRevealable,
  reveal,
  tickTimer,
  toggleFlag,
} from "./game.ts";

const DIFFICULTY_STORAGE_KEY = "minesweeper-difficulty";

function readStoredDifficulty(): Difficulty {
  if (typeof window === "undefined") return DIFFICULTIES[1]!;
  try {
    const id = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (d) return d;
  } catch {
    /* ignore */
  }
  return DIFFICULTIES[1]!;
}

function persistDifficulty(difficulty: Difficulty) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty.id);
  } catch {
    /* ignore */
  }
}

const NUMBER_COLORS: Record<number, string> = {
  1: "text-[var(--n1)]",
  2: "text-[var(--n2)]",
  3: "text-[var(--n3)]",
  4: "text-[var(--n4)]",
  5: "text-[var(--n5)]",
  6: "text-[var(--n6)]",
  7: "text-[var(--n7)]",
  8: "text-[var(--n8)]",
};

function formatTime(seconds: number): string {
  return String(Math.min(999, Math.floor(seconds))).padStart(3, "0");
}

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_PX = 12;

function CellButton({
  cell,
  row,
  col,
  gameOver,
  highlight,
  onReveal,
  onFlag,
}: {
  cell: Cell;
  row: number;
  col: number;
  gameOver: boolean;
  highlight?: HintRole;
  onReveal: (row: number, col: number) => void;
  onFlag: (row: number, col: number) => void;
}) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClickRef = useRef(false);
  const recentLongPressFlagRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== undefined) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  }, []);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (gameOver || cell.revealed) return;
      if (e.pointerType !== "touch" || e.button !== 0) return;
      clearLongPressTimer();
      touchStartRef.current = { x: e.clientX, y: e.clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = undefined;
        recentLongPressFlagRef.current = true;
        suppressClickRef.current = true;
        onFlag(row, col);
        window.setTimeout(() => {
          recentLongPressFlagRef.current = false;
        }, 600);
      }, LONG_PRESS_MS);
      try {
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [gameOver, cell.revealed, clearLongPressTimer, onFlag, row, col],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (longPressTimerRef.current === undefined || !touchStartRef.current) return;
      if (e.pointerType !== "touch") return;
      const { x, y } = touchStartRef.current;
      const dx = Math.abs(e.clientX - x);
      const dy = Math.abs(e.clientY - y);
      if (dx > LONG_PRESS_MOVE_PX || dy > LONG_PRESS_MOVE_PX) {
        clearLongPressTimer();
        touchStartRef.current = null;
      }
    },
    [clearLongPressTimer],
  );

  const handlePointerUpOrCancel = useCallback(
    (e: React.PointerEvent) => {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      clearLongPressTimer();
      touchStartRef.current = null;
    },
    [clearLongPressTimer],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickRef.current = false;
        return;
      }
      onReveal(row, col);
    },
    [onReveal, row, col],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (gameOver || cell.revealed) return;
      if (recentLongPressFlagRef.current) return;
      onFlag(row, col);
    },
    [gameOver, cell.revealed, onFlag, row, col],
  );

  let content: React.ReactNode = null;
  if (cell.flagged && !gameOver)
    content = (
      <Flag className="size-[0.85em] shrink-0 text-destructive" strokeWidth={2.25} aria-hidden />
    );
  else if (cell.revealed && cell.isMine)
    content = (
      <span
        className="size-[0.6em] min-h-[0.6em] min-w-[0.6em] shrink-0 rounded-full bg-destructive"
        aria-hidden
      />
    );
  else if (cell.revealed && cell.adjacent > 0)
    content = (
      <span className="tabular-nums [text-box-trim:trim-both] [text-box-edge:cap_alphabetic]">
        {cell.adjacent}
      </span>
    );

  const wrongFlag = gameOver && cell.flagged && !cell.isMine;

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onPointerLeave={handlePointerUpOrCancel}
      onContextMenu={handleContextMenu}
      aria-label={`Cell row ${row + 1} column ${col + 1}`}
      className={cn(
        "grid size-full min-h-0 min-w-0 place-items-center p-0 text-[clamp(0.7rem,3.2vw,0.95rem)] font-bold leading-none select-none touch-manipulation [-webkit-touch-callout:none]",
        "transition-transform duration-100 ease-out",
        cell.revealed
          ? [
              "cursor-default border border-foreground/10 bg-background",
              cell.isMine && "bg-destructive/15 text-destructive",
              !cell.isMine && cell.adjacent > 0 && NUMBER_COLORS[cell.adjacent],
            ]
          : [
              "cursor-pointer border-2",
              "bg-[hsl(220,14%,80%)] dark:bg-[hsl(220,10%,32%)]",
              "border-t-[hsl(220,14%,92%)] border-l-[hsl(220,14%,92%)] border-b-[hsl(220,14%,58%)] border-r-[hsl(220,14%,58%)]",
              "dark:border-t-[hsl(220,10%,44%)] dark:border-l-[hsl(220,10%,44%)] dark:border-b-[hsl(220,10%,18%)] dark:border-r-[hsl(220,10%,18%)]",
              "active:scale-95 active:border-foreground/20",
              "hover:brightness-105",
            ],
        wrongFlag && "bg-destructive/20 line-through",
        highlight === "clue" && "relative z-10 ring-2 ring-inset ring-ring",
        highlight === "clue-a" && cn("relative z-10 ring-2 ring-inset", HINT_CLUE_A_RING),
        highlight === "clue-b" && cn("relative z-10 ring-2 ring-inset", HINT_CLUE_B_RING),
        highlight === "scope" && cn("relative z-10", HINT_SCOPE_SURFACE),
        highlight === "focus" &&
          "relative z-10 ring-2 ring-inset ring-amber-500 dark:ring-amber-400",
        highlight === "error-clue" &&
          "relative z-10 ring-2 ring-inset ring-destructive ring-offset-0",
        highlight === "error-near" &&
          "relative z-10 ring-2 ring-inset ring-amber-500/90 dark:ring-amber-400/90",
      )}
    >
      {content}
    </button>
  );
}

function StatReadout({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Flag;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="inline-flex min-h-11 min-w-22 items-center justify-center gap-1.5 rounded-md bg-muted px-2.5 font-mono text-sm tabular-nums sm:h-7 sm:min-h-0 sm:min-w-18 sm:px-2"
      role="status"
      aria-label={label}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground sm:size-3.5" aria-hidden />
      {children}
    </div>
  );
}

function ThemeToggle({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (v: ThemePreference) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={preference}
      onValueChange={(v) => {
        if (v === "light" || v === "dark" || v === "system") onChange(v);
      }}
      className="shrink-0"
      aria-label="Color theme"
    >
      <ToggleGroupItem
        value="system"
        className="min-h-11 min-w-11 px-2 sm:min-h-9 sm:min-w-9"
        title="Use device theme"
        aria-label="Use system color theme"
      >
        <Monitor className="size-3.5" aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="light"
        className="min-h-11 min-w-11 px-2 sm:min-h-9 sm:min-w-9"
        title="Light"
        aria-label="Light color theme"
      >
        <Sun className="size-3.5" aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="dark"
        className="min-h-11 min-w-11 px-2 sm:min-h-9 sm:min-w-9"
        title="Dark"
        aria-label="Dark color theme"
      >
        <Moon className="size-3.5" aria-hidden />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export default function App() {
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const { trigger: triggerHaptic, isSupported: hapticsSupported } = useWebHaptics();

  const hapticMobile = useCallback(
    (preset: "success" | "error" | "selection" | "light") => {
      if (!hapticsSupported || typeof window === "undefined") return;
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      void triggerHaptic(preset);
    },
    [hapticsSupported, triggerHaptic],
  );
  const [game, setGame] = useState<GameState>(() => createGame(readStoredDifficulty()));
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const gameRef = useRef(game);
  gameRef.current = game;

  const [activeHint, setActiveHint] = useState<Hint | null>(null);
  const [flagContradiction, setFlagContradiction] = useState<LocalFlagContradiction | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [helpBanner, setHelpBanner] = useState<string | null>(null);
  const activeHintRef = useRef<Hint | null>(null);
  activeHintRef.current = activeHint;
  const highlightClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const undoStackRef = useRef<GameState[]>([]);
  const redoStackRef = useRef<GameState[]>([]);

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

  const dismissHintDialog = useCallback(() => {
    setHelpDialogOpen(false);
    scheduleHighlightClear();
  }, [scheduleHighlightClear]);

  useEffect(() => () => cancelHighlightClear(), [cancelHighlightClear]);

  const highlightByKey = useMemo(() => {
    const m = new Map<string, HintRole>();
    if (activeHint) {
      for (const c of activeHint.cells) {
        m.set(`${c.row},${c.col}`, c.role);
      }
    } else if (flagContradiction) {
      for (const h of flagContradiction.highlightCells) {
        m.set(`${h.row},${h.col}`, h.role);
      }
    }
    return m;
  }, [activeHint, flagContradiction]);

  const hintNarrative = activeHint ? getHintNarrative(game, activeHint) : null;

  const forceRender = useCallback(() => setTick((n) => n + 1), []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      tickTimer(gameRef.current, 1);
      forceRender();
    }, 1000);
  }, [stopTimer, forceRender]);

  useEffect(() => stopTimer, [stopTimer]);

  const pushUndoSnapshot = useCallback(() => {
    const g = gameRef.current;
    const stack = undoStackRef.current;
    stack.push(cloneGameState(g));
    redoStackRef.current = [];
  }, []);

  const handleReveal = useCallback(
    (row: number, col: number) => {
      const g = gameRef.current;
      const canReveal = isRevealable(g, row, col);
      if (canReveal) pushUndoSnapshot();
      const wasPlaying = g.status === "playing";
      setHelpBanner(null);
      clearHintFully();
      reveal(g, row, col);
      if (canReveal) {
        if (g.status === "lost") hapticMobile("error");
        else if (g.status === "won") hapticMobile("success");
        else hapticMobile("selection");
      }
      if (!wasPlaying && g.status === "playing") startTimer();
      if (g.status === "won" || g.status === "lost") stopTimer();
      forceRender();
    },
    [startTimer, stopTimer, forceRender, clearHintFully, pushUndoSnapshot, hapticMobile],
  );

  const handleUndoReveal = useCallback(() => {
    const stack = undoStackRef.current;
    const snap = stack.pop();
    if (!snap) return;
    const cur = gameRef.current;
    const redo = redoStackRef.current;
    redo.push(cloneGameState(cur));
    stopTimer();
    clearHintFully();
    setHelpBanner(null);
    gameRef.current = snap;
    setGame(snap);
    if (snap.status === "playing" && snap.started) startTimer();
    forceRender();
  }, [stopTimer, clearHintFully, startTimer, forceRender]);

  const handleRedoReveal = useCallback(() => {
    const stack = redoStackRef.current;
    const snap = stack.pop();
    if (!snap) return;
    const undo = undoStackRef.current;
    undo.push(cloneGameState(gameRef.current));
    stopTimer();
    clearHintFully();
    setHelpBanner(null);
    gameRef.current = snap;
    setGame(snap);
    if (snap.status === "playing" && snap.started) startTimer();
    forceRender();
  }, [stopTimer, clearHintFully, startTimer, forceRender]);

  const handleFlag = useCallback(
    (row: number, col: number) => {
      const g = gameRef.current;
      const idx = row * g.cols + col;
      const wasFlagged = g.cells[idx]!.flagged;
      setHelpBanner(null);
      clearHintFully();
      toggleFlag(g, row, col);
      const toggled = g.cells[idx]!.flagged !== wasFlagged;
      if (toggled) {
        if (g.status === "won") hapticMobile("success");
        else hapticMobile("light");
      }
      if (g.status === "won" || g.status === "lost") stopTimer();
      forceRender();
    },
    [stopTimer, forceRender, clearHintFully, hapticMobile],
  );

  const handleHelp = useCallback(() => {
    const g = gameRef.current;
    if (helpDialogOpen) {
      dismissHintDialog();
      return;
    }
    if (activeHintRef.current) {
      cancelHighlightClear();
      setHelpDialogOpen(true);
      return;
    }
    if (g.status !== "playing") {
      setHelpBanner(
        g.status === "idle"
          ? "Reveal a cell first—pattern help (H) works once the game is in progress."
          : "Start a new game to use pattern help.",
      );
      return;
    }
    const flagIssue = getLocalFlagContradiction(g);
    if (flagIssue) {
      setHelpBanner(null);
      cancelHighlightClear();
      setActiveHint(null);
      setFlagContradiction(flagIssue);
      setHelpDialogOpen(true);
      return;
    }
    const h = findHint(g);
    if (!h) {
      setHelpBanner(
        `No move can be derived from visible clues with the techniques help teaches—recheck flags, look for overlapping regions, or guess. ${NO_FORCED_MOVE_HINT}`,
      );
      return;
    }
    setHelpBanner(null);
    cancelHighlightClear();
    setFlagContradiction(null);
    setActiveHint(h);
    setHelpDialogOpen(true);
  }, [helpDialogOpen, dismissHintDialog, cancelHighlightClear]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const inEditable =
        (t instanceof HTMLElement && t.isContentEditable) ||
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (inEditable) return;
        e.preventDefault();
        if (e.shiftKey) handleRedoReveal();
        else handleUndoReveal();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k !== "h") return;
      if (inEditable) return;
      e.preventDefault();
      handleHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleHelp, handleUndoReveal, handleRedoReveal]);

  const resetGame = useCallback(
    (difficulty: Difficulty) => {
      stopTimer();
      clearHintFully();
      setHelpBanner(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      const g = createGame(difficulty);
      setGame(g);
      gameRef.current = g;
      persistDifficulty(difficulty);
    },
    [stopTimer, clearHintFully],
  );

  const currentDifficulty =
    DIFFICULTIES.find(
      (d) => d.rows === game.rows && d.cols === game.cols && d.mines === game.mineTotal,
    ) ?? DIFFICULTIES[1]!;

  const minesRemaining = Math.max(0, game.mineTotal - flagCount(game));
  const gameOver = game.status === "won" || game.status === "lost";

  return (
    <div className="flex min-h-svh items-center justify-center p-2 sm:p-4">
      <Dialog
        open={helpDialogOpen}
        onOpenChange={(open) => {
          if (!open) dismissHintDialog();
        }}
      >
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          {activeHint && hintNarrative ? (
            <>
              <DialogHeader>
                <DialogTitle>{hintNarrative.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <HintRegionPreview game={game} hint={activeHint} />
                <HintExplanation narrative={hintNarrative} />
              </div>
            </>
          ) : flagContradiction ? (
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
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {flagContradiction.message}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <main className="flex w-fit max-w-[98vw] flex-col gap-2 sm:max-w-[96vw] sm:gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Minesweeper</h1>
          <ThemeToggle preference={themePreference} onChange={setThemePreference} />
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full justify-stretch"
          aria-label="Game difficulty"
          value={currentDifficulty.id}
          onValueChange={(id) => {
            if (!id) return;
            const d = DIFFICULTIES.find((x) => x.id === id);
            if (d) resetGame(d);
          }}
        >
          {DIFFICULTIES.map((d) => (
            <ToggleGroupItem
              key={d.id}
              value={d.id}
              className="min-h-11 min-w-0 flex-1 text-sm sm:min-h-8 sm:text-xs"
            >
              {d.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <StatReadout icon={Flag} label={`Mines remaining: ${minesRemaining}`}>
            {String(minesRemaining).padStart(3, "0")}
          </StatReadout>

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 sm:h-8 sm:w-8"
            onClick={() => resetGame(currentDifficulty)}
            aria-label="New game"
          >
            {gameOver ? (
              game.status === "won" ? (
                <Sparkles className="size-4" />
              ) : (
                <Frown className="size-4" />
              )
            ) : (
              <RotateCcw className="size-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 sm:h-8 sm:w-8"
            onClick={handleHelp}
            aria-label="Pattern help"
            title="Pattern help (H)"
          >
            <CircleHelp className="size-4" />
          </Button>

          <StatReadout
            icon={Timer}
            label={`Elapsed time: ${formatTime(game.elapsedSeconds)} seconds`}
          >
            {formatTime(game.elapsedSeconds)}
          </StatReadout>
        </div>

        <div
          className="mx-auto grid w-fit overflow-hidden rounded-md bg-muted/50"
          style={
            {
              gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${game.rows}, minmax(0, 1fr))`,
              width: `min(95vw, ${game.cols * 28 + 8}px)`,
              aspectRatio: `${game.cols} / ${game.rows}`,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: game.rows }, (_, row) =>
            Array.from({ length: game.cols }, (_, col) => {
              const cell = game.cells[row * game.cols + col]!;
              const hk = `${row},${col}`;
              return (
                <CellButton
                  key={`${row}-${col}`}
                  cell={cell}
                  row={row}
                  col={col}
                  gameOver={gameOver}
                  highlight={highlightByKey.get(hk)}
                  onReveal={handleReveal}
                  onFlag={handleFlag}
                />
              );
            }),
          )}
        </div>

        <p
          className={cn(
            "text-center text-xs",
            gameOver
              ? [
                  "font-medium",
                  game.status === "won"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive",
                ]
              : "text-muted-foreground",
          )}
          aria-live="polite"
        >
          {gameOver ? (
            game.status === "won" ? (
              "You cleared the field!"
            ) : (
              "Boom! Better luck next time."
            )
          ) : helpBanner ? (
            helpBanner
          ) : (
            <>
              <span className="sm:hidden">
                Tap to reveal · Long-press to flag · First tap is always safe
              </span>
              <span className="hidden sm:inline">
                Click to reveal · Right-click to flag · Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z) ·
                Pattern help (H) · First tap is always safe
              </span>
            </>
          )}
        </p>
      </main>
    </div>
  );
}
