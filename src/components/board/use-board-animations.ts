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

const REVEAL_BASE_STAGGER = 75;
const REVEAL_MAX_STAGGER = 480;
const LARGE_BATCH_THRESHOLD = 180;
const ACCELERATE_DECELERATE = "cubic-bezier(0.42, 0, 0.58, 1)";
const CLASS_REVEAL = "board-cell--anim-reveal";
const CLASS_FLAG = "board-cell--anim-flag";
const CLASS_UNFLAG = "board-cell--anim-unflag";
const CLASS_EXPLODE = "board-cell--anim-explode";
const CLASS_WRONG_FLAG = "board-cell--anim-wrong-flag";
const CLASS_WIN_FLAG = "board-cell--anim-win-flag";

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

  const queueTimeout = useCallback((callback: () => void, delay: number) => {
    const timeout = window.setTimeout(callback, delay);
    timeoutsRef.current.push(timeout);
  }, []);

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
      queueTimeout(() => clearEffects(id), duration);
    },
    [clearEffects, queueTimeout],
  );

  const applyClassAnimation = useCallback(
    (node: HTMLButtonElement, className: string, delay: number, duration: number) => {
      node.style.setProperty("--board-delay", `${delay}ms`);
      node.style.setProperty("--board-duration", `${duration}ms`);
      node.classList.remove(
        CLASS_REVEAL,
        CLASS_FLAG,
        CLASS_UNFLAG,
        CLASS_EXPLODE,
        CLASS_WRONG_FLAG,
        CLASS_WIN_FLAG,
      );
      // Force restart for repeated interactions on the same node.
      void node.offsetWidth;
      node.classList.add(className);
      queueTimeout(
        () => {
          node.classList.remove(className);
          node.style.removeProperty("--board-delay");
          node.style.removeProperty("--board-duration");
        },
        delay + duration + 40,
      );
    },
    [queueTimeout],
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

    const durationMultiplier = Math.max(0.35, animationSpeed);
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
      const delay = Math.min(REVEAL_MAX_STAGGER, dist * REVEAL_BASE_STAGGER) * durationMultiplier;
      const content = node.querySelector<HTMLElement>(".board-cell__content");
      node.getAnimations().forEach((animation) => animation.cancel());
      content?.getAnimations().forEach((animation) => animation.cancel());
      if (change.kind === "revealed") {
        applyClassAnimation(node, CLASS_REVEAL, delay, 720 * durationMultiplier);
        content?.animate(
          [
            { opacity: 0, transform: "translateZ(0) scale(0.82)" },
            { offset: 0.55, opacity: 1, transform: "translateZ(0) scale(1.08)" },
            { opacity: 1, transform: "translateZ(0) scale(1)" },
          ],
          {
            duration: 280 * durationMultiplier,
            delay,
            easing: ACCELERATE_DECELERATE,
            fill: "both",
          },
        );
      } else if (change.kind === "flagged" || change.kind === "wonAutoFlag") {
        applyClassAnimation(
          node,
          change.kind === "wonAutoFlag" ? CLASS_WIN_FLAG : CLASS_FLAG,
          delay,
          220 * durationMultiplier,
        );
        content?.animate(
          [
            { transform: "translateZ(0) scale(0.76) translateY(4px)", opacity: 0.4 },
            {
              offset: 0.65,
              transform: "translateZ(0) scale(1.12) translateY(-1px)",
              opacity: 1,
            },
            { transform: "translateZ(0) scale(1) translateY(0)", opacity: 1 },
          ],
          {
            duration: 220 * durationMultiplier,
            delay,
            easing: ACCELERATE_DECELERATE,
            fill: "both",
          },
        );
      } else if (change.kind === "unflagged") {
        applyClassAnimation(node, CLASS_UNFLAG, delay, 180 * durationMultiplier);
        content?.animate(
          [
            { transform: "translateZ(0) scale(1)", opacity: 1 },
            { transform: "translateZ(0) scale(0.72)", opacity: 0.3 },
            { transform: "translateZ(0) scale(0.92)", opacity: 0 },
          ],
          {
            duration: 180 * durationMultiplier,
            delay,
            easing: ACCELERATE_DECELERATE,
            fill: "both",
          },
        );
      } else if (change.kind === "exploded") {
        applyClassAnimation(node, CLASS_EXPLODE, delay, 280 * durationMultiplier);
        content?.animate(
          [
            { transform: "translateZ(0) scale(0.85)", opacity: 0.5 },
            { offset: 0.35, transform: "translateZ(0) scale(1.18)", opacity: 1 },
            { transform: "translateZ(0) scale(1)", opacity: 1 },
          ],
          {
            duration: 280 * durationMultiplier,
            delay,
            easing: ACCELERATE_DECELERATE,
            fill: "both",
          },
        );
      } else if (change.kind === "wrongFlag") {
        applyClassAnimation(node, CLASS_WRONG_FLAG, delay, 240 * durationMultiplier);
        content?.animate(
          [
            { transform: "translateZ(0) scale(1)", opacity: 1 },
            { transform: "translateZ(0) scale(0.88)", opacity: 0.72 },
            { transform: "translateZ(0) scale(1)", opacity: 1 },
          ],
          {
            duration: 240 * durationMultiplier,
            delay,
            easing: ACCELERATE_DECELERATE,
            fill: "both",
          },
        );
      }
    }

    const centerX = (sourceCol + 0.5) * cellSize;
    const centerY = (sourceRow + 0.5) * cellSize;
    if (game.status === "lost") {
      enqueueEffect({ kind: "loss-shock", x: centerX, y: centerY }, 420 * durationMultiplier);
    } else if (game.status === "won") {
      enqueueEffect({ kind: "win-sweep", x: centerX, y: centerY }, 700 * durationMultiplier);
    } else if (changes.some((change) => change.kind === "revealed")) {
      enqueueEffect({ kind: "reveal-ripple", x: centerX, y: centerY }, 720 * durationMultiplier);
    }
  }, [
    animationSpeed,
    applyClassAnimation,
    cellSize,
    clearEffects,
    enqueueEffect,
    game,
    interaction,
  ]);

  return {
    effects,
    registerCell,
  };
}
