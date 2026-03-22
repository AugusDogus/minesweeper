import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { HintRegionPreview } from "@/components/hint-region-preview.tsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HINT_CLUE_A_RING, HINT_CLUE_B_RING, HINT_SCOPE_SURFACE } from "@/lib/hint-clue-rings.ts";
import { cn } from "@/lib/utils";

import {
  CSP_HINT_WINDOW_SIZE,
  type Hint,
  type HintRole,
  findHint,
  getCspFrontierMeta,
  getHintNarrative,
} from "./hints.ts";
import { type ThemePreference, useThemePreference } from "./use-theme.ts";

import {
  type Cell,
  type Difficulty,
  DIFFICULTIES,
  type GameState,
  NO_FORCED_MOVE_HINT,
  cloneGameState,
  createGame,
  describeLocalFlagContradictions,
  flagCount,
  isRevealable,
  reveal,
  tickTimer,
  toggleFlag,
} from "./game.ts";

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
  const handleClick = useCallback(() => onReveal(row, col), [onReveal, row, col]);
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 2) return;
      e.preventDefault();
      onFlag(row, col);
    },
    [onFlag, row, col],
  );
  const handleContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  let content: React.ReactNode = null;
  if (cell.flagged && !gameOver)
    content = (
      <Flag className="size-[0.7em] shrink-0 text-destructive" strokeWidth={2.25} aria-hidden />
    );
  else if (cell.revealed && cell.isMine)
    content = (
      <span
        className="size-[0.5em] min-h-[0.5em] min-w-[0.5em] shrink-0 rounded-full bg-destructive"
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
      onContextMenu={handleContextMenu}
      aria-label={`Cell row ${row + 1} column ${col + 1}`}
      className={cn(
        "grid size-full min-h-0 min-w-0 place-items-center p-0 text-[clamp(0.6rem,2.5vw,0.85rem)] font-bold leading-none select-none",
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
      className="inline-flex h-7 min-w-18 items-center justify-center gap-1.5 rounded-md bg-muted px-2 font-mono text-sm tabular-nums"
      role="status"
      aria-label={label}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
      <ToggleGroupItem value="system" className="px-2" title="Use device theme">
        <Monitor className="size-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem value="light" className="px-2" title="Light">
        <Sun className="size-3.5" />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" className="px-2" title="Dark">
        <Moon className="size-3.5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export default function App() {
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const [game, setGame] = useState<GameState>(() => createGame(DIFFICULTIES[1]!));
  const [, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const gameRef = useRef(game);
  gameRef.current = game;

  const [activeHint, setActiveHint] = useState<Hint | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [helpBanner, setHelpBanner] = useState<string | null>(null);
  const activeHintRef = useRef<Hint | null>(null);
  activeHintRef.current = activeHint;
  const highlightClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const undoStackRef = useRef<GameState[]>([]);
  const redoStackRef = useRef<GameState[]>([]);
  /** Which sliding CSP window (0-based) to search on the next hint request when the frontier is large. */
  const cspWindowPassRef = useRef(0);

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
      highlightClearTimeoutRef.current = undefined;
    }, 3000);
  }, [cancelHighlightClear]);

  const clearHintFully = useCallback(() => {
    cancelHighlightClear();
    setActiveHint(null);
    setHelpDialogOpen(false);
  }, [cancelHighlightClear]);

  const dismissHintDialog = useCallback(() => {
    setHelpDialogOpen(false);
    scheduleHighlightClear();
  }, [scheduleHighlightClear]);

  useEffect(() => () => cancelHighlightClear(), [cancelHighlightClear]);

  const highlightByKey = useMemo(() => {
    const m = new Map<string, HintRole>();
    if (!activeHint) return m;
    for (const c of activeHint.cells) {
      m.set(`${c.row},${c.col}`, c.role);
    }
    return m;
  }, [activeHint]);

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
      if (isRevealable(g, row, col)) pushUndoSnapshot();
      const wasPlaying = g.status === "playing";
      setHelpBanner(null);
      cspWindowPassRef.current = 0;
      clearHintFully();
      reveal(g, row, col);
      if (!wasPlaying && g.status === "playing") startTimer();
      if (g.status === "won" || g.status === "lost") stopTimer();
      forceRender();
    },
    [startTimer, stopTimer, forceRender, clearHintFully, pushUndoSnapshot],
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
    cspWindowPassRef.current = 0;
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
    cspWindowPassRef.current = 0;
    gameRef.current = snap;
    setGame(snap);
    if (snap.status === "playing" && snap.started) startTimer();
    forceRender();
  }, [stopTimer, clearHintFully, startTimer, forceRender]);

  const handleFlag = useCallback(
    (row: number, col: number) => {
      const g = gameRef.current;
      setHelpBanner(null);
      cspWindowPassRef.current = 0;
      clearHintFully();
      toggleFlag(g, row, col);
      if (g.status === "won" || g.status === "lost") stopTimer();
      forceRender();
    },
    [stopTimer, forceRender, clearHintFully],
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
          ? "Reveal a cell first—pattern help works once the game is in progress."
          : "Start a new game to use pattern help.",
      );
      return;
    }
    const flagIssue = describeLocalFlagContradictions(g);
    if (flagIssue) {
      cspWindowPassRef.current = 0;
      setHelpBanner(flagIssue);
      return;
    }
    const pass = cspWindowPassRef.current;
    const h = findHint(g, { cspWindowPass: pass });
    if (!h) {
      const meta = getCspFrontierMeta(g);
      if (meta.windowCount > 1 && pass < meta.windowCount - 1) {
        cspWindowPassRef.current = pass + 1;
        setHelpBanner(
          `No logical move in search region ${pass + 1} of ${meta.windowCount}. Press H again to search the next ${CSP_HINT_WINDOW_SIZE} cells.`,
        );
        return;
      }
      cspWindowPassRef.current = 0;
      if (meta.windowCount > 1 && pass >= meta.windowCount - 1) {
        setHelpBanner(
          `Searched all ${meta.windowCount} regions—still no simple logical move. ${NO_FORCED_MOVE_HINT}`,
        );
        return;
      }
      setHelpBanner(`No simple logical move found. ${NO_FORCED_MOVE_HINT}`);
      return;
    }
    cspWindowPassRef.current = 0;
    setHelpBanner(null);
    cancelHighlightClear();
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
      cspWindowPassRef.current = 0;
      undoStackRef.current = [];
      redoStackRef.current = [];
      const g = createGame(difficulty);
      setGame(g);
      gameRef.current = g;
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
    <div className="flex min-h-svh items-center justify-center p-4">
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
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="flex w-fit max-w-[96vw] flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Minesweeper</h1>
          <ThemeToggle preference={themePreference} onChange={setThemePreference} />
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full justify-stretch"
          value={currentDifficulty.id}
          onValueChange={(id) => {
            if (!id) return;
            const d = DIFFICULTIES.find((x) => x.id === id);
            if (d) resetGame(d);
          }}
        >
          {DIFFICULTIES.map((d) => (
            <ToggleGroupItem key={d.id} value={d.id} className="min-w-0 flex-1 text-xs">
              {d.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center justify-center gap-2">
          <StatReadout icon={Flag} label={`Mines remaining: ${minesRemaining}`}>
            {String(minesRemaining).padStart(3, "0")}
          </StatReadout>

          <Button
            variant="ghost"
            size="icon-sm"
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
            size="icon-sm"
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
              width: `min(88vw, ${game.cols * 28 + 8}px)`,
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
              : "text-muted-foreground/70",
          )}
          aria-live="polite"
        >
          {gameOver
            ? game.status === "won"
              ? "You cleared the field!"
              : "Boom! Better luck next time."
            : helpBanner
              ? helpBanner
              : "Click to reveal \u00b7 Right-click to flag \u00b7 Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z) \u00b7 Pattern help (H toggles) \u00b7 First click is always safe"}
        </p>
      </div>
    </div>
  );
}
