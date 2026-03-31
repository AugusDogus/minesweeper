import { useRef } from "react";

import type { Difficulty } from "@/game.ts";
import { cn } from "@/lib/utils.ts";

export function DifficultySwipeSelector({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (difficulty: Difficulty) => void;
  options: readonly Difficulty[];
}) {
  const pointerStartRef = useRef<number | null>(null);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );

  return (
    <div
      className="difficulty-selector"
      onPointerDown={(event) => {
        pointerStartRef.current = event.clientX;
      }}
      onPointerUp={(event) => {
        if (pointerStartRef.current === null) return;
        const delta = event.clientX - pointerStartRef.current;
        pointerStartRef.current = null;
        if (Math.abs(delta) < 26) return;
        const direction = delta > 0 ? -1 : 1;
        const nextIndex = Math.max(0, Math.min(options.length - 1, activeIndex + direction));
        onChange(options[nextIndex]!);
      }}
    >
      <div
        className="difficulty-selector__thumb"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {options.map((difficulty) => (
        <button
          key={difficulty.id}
          type="button"
          className={cn(
            "difficulty-selector__option",
            difficulty.id === value && "difficulty-selector__option--active",
          )}
          onClick={() => onChange(difficulty)}
        >
          <span>{difficulty.label}</span>
          <span className="difficulty-selector__meta">
            {difficulty.cols}×{difficulty.rows} · {difficulty.mines}
          </span>
        </button>
      ))}
    </div>
  );
}
