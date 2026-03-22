import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, Frown, Monitor, Moon, RotateCcw, Sparkles, Sun, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { type ThemePreference, useThemePreference } from "./use-theme.ts";

import {
  type Cell,
  type Difficulty,
  DIFFICULTIES,
  type GameState,
  createGame,
  flagCount,
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
  onReveal,
  onFlag,
}: {
  cell: Cell;
  row: number;
  col: number;
  gameOver: boolean;
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

  const handleReveal = useCallback(
    (row: number, col: number) => {
      const g = gameRef.current;
      const wasPlaying = g.status === "playing";
      reveal(g, row, col);
      if (!wasPlaying && g.status === "playing") startTimer();
      if (g.status === "won" || g.status === "lost") stopTimer();
      forceRender();
    },
    [startTimer, stopTimer, forceRender],
  );

  const handleFlag = useCallback(
    (row: number, col: number) => {
      const g = gameRef.current;
      toggleFlag(g, row, col);
      if (g.status === "won" || g.status === "lost") stopTimer();
      forceRender();
    },
    [stopTimer, forceRender],
  );

  const resetGame = useCallback(
    (difficulty: Difficulty) => {
      stopTimer();
      const g = createGame(difficulty);
      setGame(g);
      gameRef.current = g;
    },
    [stopTimer],
  );

  const currentDifficulty =
    DIFFICULTIES.find(
      (d) => d.rows === game.rows && d.cols === game.cols && d.mines === game.mineTotal,
    ) ?? DIFFICULTIES[1]!;

  const minesRemaining = Math.max(0, game.mineTotal - flagCount(game));
  const gameOver = game.status === "won" || game.status === "lost";

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
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

          <StatReadout
            icon={Timer}
            label={`Elapsed time: ${formatTime(game.elapsedSeconds)} seconds`}
          >
            {formatTime(game.elapsedSeconds)}
          </StatReadout>
        </div>

        <div
          className="grid w-fit overflow-hidden rounded-md bg-muted/50"
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
              return (
                <CellButton
                  key={`${row}-${col}`}
                  cell={cell}
                  row={row}
                  col={col}
                  gameOver={gameOver}
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
            : "Click to reveal \u00b7 Right-click to flag \u00b7 First click is always safe"}
        </p>
      </div>
    </div>
  );
}
