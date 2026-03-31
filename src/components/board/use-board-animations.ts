import { useCallback, useEffect, useRef, useState } from "react";

import { cloneGameState, type GameState } from "@/game.ts";
import { diffBoard } from "@/components/board/board-diff.ts";
import type { OverlayEffect } from "@/components/board/board-overlay.tsx";

export type BoardInteraction = {
  readonly token: number;
  readonly row: number;
  readonly col: number;
  readonly kind: "primary" | "secondary";
} | null;

const REVEAL_BASE_STAGGER = 12;
const REVEAL_MAX_STAGGER = 180;
const LARGE_BATCH_THRESHOLD = 180;

function makeCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function distance(aRow: number, aCol: number, bRow: number, bCol: number): number {
  return Math.hypot(aRow - bRow, aCol - bCol);
}

export function useBoardAnimations({
  game,
  interaction,
  cellSize,
  animationSpeed,
}: {
  game: GameState;
  interaction: BoardInteraction;
  cellSize: number;
  animationSpeed: number;
}) {
  const previousGameRef = useRef(cloneGameState(game));
  const nodesRef = useRef(new Map<string, HTMLButtonElement>());
  const timeoutsRef = useRef<number[]>([]);
  const [effects, setEffects] = useState<OverlayEffect[]>([]);

  const registerCell = useCallback((key: string, node: HTMLButtonElement | null) => {
    if (node) nodesRef.current.set(key, node);
    else nodesRef.current.delete(key);
  }, []);

  const clearEffects = useCallback((id: number) => {
    setEffects((current) => current.filter((effect) => effect.id !== id));
  }, []);

  const enqueueEffect = useCallback(
    (effect: Omit<OverlayEffect, "id">, duration: number) => {
      const id = window.setTimeout(() => undefined, 0);
      setEffects((current) => [...current, { ...effect, id }]);
      const timeout = window.setTimeout(() => clearEffects(id), duration);
      timeoutsRef.current.push(timeout);
    },
    [clearEffects],
  );

  useEffect(() => {
    return () => {
      for (const timeout of timeoutsRef.current) {
        window.clearTimeout(timeout);
      }
    };
  }, []);

  useEffect(() => {
    const previous = previousGameRef.current;
    const changes = diffBoard(previous, game);
    previousGameRef.current = cloneGameState(game);

    if (changes.length === 0) return;
    if (animationSpeed === 0) return;

    const speedFactor = 1 / Math.max(0.65, animationSpeed);
    const sourceRow = interaction?.row ?? changes[0]!.row;
    const sourceCol = interaction?.col ?? changes[0]!.col;
    const sorted = [...changes].sort((a, b) => {
      return (
        distance(a.row, a.col, sourceRow, sourceCol) - distance(b.row, b.col, sourceRow, sourceCol)
      );
    });

    const animatedChanges = sorted.length > LARGE_BATCH_THRESHOLD ? sorted.slice(0, 72) : sorted;

    for (const change of animatedChanges) {
      const node = nodesRef.current.get(makeCellKey(change.row, change.col));
      if (!node) continue;
      const dist = distance(change.row, change.col, sourceRow, sourceCol);
      const delay = Math.min(REVEAL_MAX_STAGGER, dist * REVEAL_BASE_STAGGER) * speedFactor;
      node.getAnimations().forEach((animation) => animation.cancel());

      if (change.kind === "revealed") {
        node.animate(
          [
            { transform: "translateZ(0) scale(0.94)", filter: "brightness(1.18)" },
            { offset: 0.55, transform: "translateZ(0) scale(1.02)", filter: "brightness(1.05)" },
            { transform: "translateZ(0) scale(1)", filter: "brightness(1)" },
          ],
          {
            duration: 140 * speedFactor,
            delay,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
            fill: "both",
          },
        );
      } else if (change.kind === "flagged" || change.kind === "wonAutoFlag") {
        node.animate(
          [
            { transform: "translateZ(0) scale(0.9) translateY(2px)", opacity: 0.7 },
            { offset: 0.65, transform: "translateZ(0) scale(1.06) translateY(-1px)", opacity: 1 },
            { transform: "translateZ(0) scale(1) translateY(0)", opacity: 1 },
          ],
          {
            duration: 120 * speedFactor,
            delay,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
            fill: "both",
          },
        );
      } else if (change.kind === "unflagged") {
        node.animate(
          [
            { transform: "translateZ(0) scale(1)", opacity: 1 },
            { transform: "translateZ(0) scale(0.96)", opacity: 0.82 },
            { transform: "translateZ(0) scale(1)", opacity: 1 },
          ],
          {
            duration: 110 * speedFactor,
            delay,
            easing: "ease-out",
            fill: "both",
          },
        );
      } else if (change.kind === "exploded") {
        node.animate(
          [
            { transform: "translateZ(0) scale(0.96)", filter: "brightness(1.2)" },
            { offset: 0.35, transform: "translateZ(0) scale(1.08)", filter: "brightness(1.35)" },
            { transform: "translateZ(0) scale(1)", filter: "brightness(1)" },
          ],
          {
            duration: 180 * speedFactor,
            delay,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
            fill: "both",
          },
        );
      } else if (change.kind === "wrongFlag") {
        node.animate(
          [
            { transform: "translateZ(0) scale(1)", opacity: 1 },
            { transform: "translateZ(0) scale(0.98)", opacity: 0.72 },
            { transform: "translateZ(0) scale(1)", opacity: 1 },
          ],
          {
            duration: 160 * speedFactor,
            delay,
            easing: "ease-out",
            fill: "both",
          },
        );
      }
    }

    const centerX = (sourceCol + 0.5) * cellSize;
    const centerY = (sourceRow + 0.5) * cellSize;
    if (game.status === "lost") {
      enqueueEffect({ kind: "loss-shock", x: centerX, y: centerY }, 420 * speedFactor);
    } else if (game.status === "won") {
      enqueueEffect({ kind: "win-sweep", x: centerX, y: centerY }, 700 * speedFactor);
    } else if (changes.some((change) => change.kind === "revealed")) {
      enqueueEffect({ kind: "reveal-ripple", x: centerX, y: centerY }, 360 * speedFactor);
    }
  }, [animationSpeed, cellSize, clearEffects, enqueueEffect, game, interaction]);

  return {
    effects,
    registerCell,
  };
}
