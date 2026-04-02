import { describe, expect, it } from "vite-plus/test";

import { shouldTriggerDoubleTapZoom } from "@/components/board/use-board-gestures.ts";

describe("shouldTriggerDoubleTapZoom", () => {
  it("accepts two fast taps in nearly the same place", () => {
    expect(
      shouldTriggerDoubleTapZoom({
        now: 200,
        lastTapAt: 40,
        x: 120,
        y: 180,
        lastTapX: 130,
        lastTapY: 176,
      }),
    ).toBe(true);
  });

  it("rejects fast taps in different places", () => {
    expect(
      shouldTriggerDoubleTapZoom({
        now: 200,
        lastTapAt: 40,
        x: 220,
        y: 240,
        lastTapX: 120,
        lastTapY: 140,
      }),
    ).toBe(false);
  });

  it("rejects slow taps even if they are close together", () => {
    expect(
      shouldTriggerDoubleTapZoom({
        now: 400,
        lastTapAt: 40,
        x: 120,
        y: 180,
        lastTapX: 126,
        lastTapY: 184,
      }),
    ).toBe(false);
  });
});
