import type { CSSProperties } from "react";

export type OverlayEffectKind = "reveal-ripple" | "loss-shock" | "win-sweep";

export type OverlayEffect = {
  readonly id: number;
  readonly kind: OverlayEffectKind;
  readonly x: number;
  readonly y: number;
};

export function BoardOverlay({
  effects,
  width,
  height,
}: {
  effects: readonly OverlayEffect[];
  width: number;
  height: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {effects.map((effect) => {
        if (effect.kind === "win-sweep") {
          return (
            <div
              key={effect.id}
              className="board-overlay board-overlay--win"
              style={
                {
                  width,
                  height,
                } as CSSProperties
              }
            />
          );
        }

        return (
          <div
            key={effect.id}
            className={
              effect.kind === "loss-shock"
                ? "board-overlay board-overlay--shock"
                : "board-overlay board-overlay--ripple"
            }
            style={
              {
                "--overlay-x": `${effect.x}px`,
                "--overlay-y": `${effect.y}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
