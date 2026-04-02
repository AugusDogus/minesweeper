import { useCallback, useLayoutEffect, useMemo, useRef } from "react";

export type ViewportState = {
  scale: number;
  tx: number;
  ty: number;
  mode: "idle" | "panning" | "pinching";
};

type PointerSnapshot = {
  startX: number;
  startY: number;
  x: number;
  y: number;
};

type Bounds = {
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
};

const DOUBLE_TAP_WINDOW_MS = 260;
const DOUBLE_TAP_SLOP_PX = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(a: PointerSnapshot, b: PointerSnapshot): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PointerSnapshot, b: PointerSnapshot): { x: number; y: number } {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function shouldTriggerDoubleTapZoom({
  now,
  lastTapAt,
  x,
  y,
  lastTapX,
  lastTapY,
}: {
  now: number;
  lastTapAt: number;
  x: number;
  y: number;
  lastTapX: number | null;
  lastTapY: number | null;
}): boolean {
  if (now - lastTapAt >= DOUBLE_TAP_WINDOW_MS) return false;
  if (lastTapX === null || lastTapY === null) return false;
  return Math.hypot(x - lastTapX, y - lastTapY) <= DOUBLE_TAP_SLOP_PX;
}

export function useBoardGestures({
  contentWidth,
  contentHeight,
  maxScale = 2.5,
  resetKey,
}: {
  contentWidth: number;
  contentHeight: number;
  maxScale?: number;
  resetKey: string | number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ViewportState>({ scale: 1, tx: 0, ty: 0, mode: "idle" });
  const fitScaleRef = useRef(1);
  const pointersRef = useRef(new Map<number, PointerSnapshot>());
  const transitionTimeoutRef = useRef<number | null>(null);
  const flingFrameRef = useRef<number | null>(null);
  const gestureMetaRef = useRef({
    moved: false,
    suppressClickUntil: 0,
    panOriginTx: 0,
    panOriginTy: 0,
    pinchDistance: 0,
    pinchScale: 1,
    lastTapAt: 0,
    lastTapX: null as number | null,
    lastTapY: null as number | null,
    lastMoveAt: 0,
    velocityX: 0,
    velocityY: 0,
  });

  const applyTransform = useCallback((nextState: ViewportState) => {
    stateRef.current = nextState;
    if (surfaceRef.current) {
      surfaceRef.current.style.transform = `translate3d(${nextState.tx}px, ${nextState.ty}px, 0) scale(${nextState.scale})`;
    }
  }, []);

  const stopFling = useCallback(() => {
    if (flingFrameRef.current !== null) {
      cancelAnimationFrame(flingFrameRef.current);
      flingFrameRef.current = null;
    }
  }, []);

  const applySurfaceTransition = useCallback((transition: string) => {
    if (!surfaceRef.current) return;
    surfaceRef.current.style.transition = transition;
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    transitionTimeoutRef.current = window.setTimeout(() => {
      if (surfaceRef.current) {
        surfaceRef.current.style.transition = "";
      }
      transitionTimeoutRef.current = null;
    }, 220);
  }, []);

  const getBounds = useCallback(
    (scale: number, tx: number, ty: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return {
          minTx: tx,
          maxTx: tx,
          minTy: ty,
          maxTy: ty,
        } satisfies Bounds;
      }
      const rect = viewport.getBoundingClientRect();
      const scaledWidth = contentWidth * scale;
      const scaledHeight = contentHeight * scale;
      const centeredTx = (rect.width - scaledWidth) / 2;
      const centeredTy = (rect.height - scaledHeight) / 2;
      const minTx = scaledWidth <= rect.width ? centeredTx : rect.width - scaledWidth;
      const maxTx = scaledWidth <= rect.width ? centeredTx : 0;
      const minTy = scaledHeight <= rect.height ? centeredTy : rect.height - scaledHeight;
      const maxTy = scaledHeight <= rect.height ? centeredTy : 0;
      return { minTx, maxTx, minTy, maxTy };
    },
    [contentHeight, contentWidth],
  );

  const clampTransform = useCallback(
    (scale: number, tx: number, ty: number) => {
      const bounds = getBounds(scale, tx, ty);
      return {
        tx: clamp(tx, bounds.minTx, bounds.maxTx),
        ty: clamp(ty, bounds.minTy, bounds.maxTy),
      };
    },
    [getBounds],
  );

  const applyResistance = useCallback(
    (scale: number, tx: number, ty: number) => {
      const bounds = getBounds(scale, tx, ty);
      let nextTx = tx;
      let nextTy = ty;
      if (tx < bounds.minTx) nextTx = bounds.minTx + (tx - bounds.minTx) / 2;
      else if (tx > bounds.maxTx) nextTx = bounds.maxTx + (tx - bounds.maxTx) / 2;
      if (ty < bounds.minTy) nextTy = bounds.minTy + (ty - bounds.minTy) / 2;
      else if (ty > bounds.maxTy) nextTy = bounds.maxTy + (ty - bounds.maxTy) / 2;
      return { tx: nextTx, ty: nextTy };
    },
    [getBounds],
  );

  const zoomAtPoint = useCallback(
    (targetScale: number, clientX: number, clientY: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const { scale, tx, ty } = stateRef.current;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const contentX = (px - tx) / scale;
      const contentY = (py - ty) / scale;
      const nextScale = clamp(
        targetScale,
        fitScaleRef.current,
        Math.max(maxScale, fitScaleRef.current * 2.75),
      );
      const rawTx = px - contentX * nextScale;
      const rawTy = py - contentY * nextScale;
      const clamped = clampTransform(nextScale, rawTx, rawTy);
      applyTransform({
        scale: nextScale,
        tx: clamped.tx,
        ty: clamped.ty,
        mode: stateRef.current.mode,
      });
    },
    [applyTransform, clampTransform, maxScale],
  );

  const resetView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const fitScale = Math.min(rect.width / contentWidth, rect.height / contentHeight);
    fitScaleRef.current = fitScale;
    const scale = fitScaleRef.current;
    const tx = (rect.width - contentWidth * scale) / 2;
    const ty = (rect.height - contentHeight * scale) / 2;
    applySurfaceTransition("transform 200ms cubic-bezier(0.23, 1, 0.32, 1)");
    applyTransform({ scale, tx, ty, mode: "idle" });
  }, [applySurfaceTransition, applyTransform, contentHeight, contentWidth]);

  const settleIntoBounds = useCallback(() => {
    const { scale, tx, ty } = stateRef.current;
    const clamped = clampTransform(scale, tx, ty);
    if (clamped.tx === tx && clamped.ty === ty) return;
    applySurfaceTransition("transform 220ms cubic-bezier(0.23, 1, 0.32, 1)");
    applyTransform({ ...stateRef.current, tx: clamped.tx, ty: clamped.ty, mode: "idle" });
  }, [applySurfaceTransition, applyTransform, clampTransform]);

  const startFling = useCallback(() => {
    stopFling();
    const startVelocityX = gestureMetaRef.current.velocityX;
    const startVelocityY = gestureMetaRef.current.velocityY;
    if (Math.hypot(startVelocityX, startVelocityY) < 0.18) {
      settleIntoBounds();
      return;
    }

    let velocityX = startVelocityX * 18;
    let velocityY = startVelocityY * 18;
    let lastTime = performance.now();

    const tick = (time: number) => {
      const elapsed = Math.min(34, time - lastTime);
      lastTime = time;
      const nextTx = stateRef.current.tx + velocityX * elapsed;
      const nextTy = stateRef.current.ty + velocityY * elapsed;
      const resisted = applyResistance(stateRef.current.scale, nextTx, nextTy);
      applyTransform({ ...stateRef.current, tx: resisted.tx, ty: resisted.ty, mode: "panning" });

      velocityX *= 0.92;
      velocityY *= 0.92;

      if (Math.hypot(velocityX, velocityY) < 0.02) {
        flingFrameRef.current = null;
        settleIntoBounds();
        return;
      }

      flingFrameRef.current = requestAnimationFrame(tick);
    };

    flingFrameRef.current = requestAnimationFrame(tick);
  }, [applyResistance, applyTransform, settleIntoBounds, stopFling]);

  useLayoutEffect(() => {
    stopFling();
    resetView();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      resetView();
    });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      stopFling();
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [resetKey, resetView, stopFling]);

  const handlers = useMemo(
    () => ({
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (gestureMetaRef.current.suppressClickUntil > performance.now()) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
        stopFling();
        const pointer: PointerSnapshot = {
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
        };
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        pointersRef.current.set(event.pointerId, pointer);
        if (pointersRef.current.size === 1) {
          gestureMetaRef.current.moved = false;
          gestureMetaRef.current.panOriginTx = stateRef.current.tx;
          gestureMetaRef.current.panOriginTy = stateRef.current.ty;
          gestureMetaRef.current.lastMoveAt = performance.now();
          gestureMetaRef.current.velocityX = 0;
          gestureMetaRef.current.velocityY = 0;
        } else if (pointersRef.current.size === 2) {
          const [first, second] = [...pointersRef.current.values()];
          gestureMetaRef.current.pinchDistance = distance(first!, second!);
          gestureMetaRef.current.pinchScale = stateRef.current.scale;
          applyTransform({ ...stateRef.current, mode: "pinching" });
        }
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        const snapshot = pointersRef.current.get(event.pointerId);
        if (!snapshot) return;
        snapshot.x = event.clientX;
        snapshot.y = event.clientY;

        if (pointersRef.current.size >= 2) {
          const [first, second] = [...pointersRef.current.values()];
          const nextDistance = distance(first!, second!);
          if (gestureMetaRef.current.pinchDistance <= 0) return;
          const targetScale =
            (gestureMetaRef.current.pinchScale * nextDistance) /
            gestureMetaRef.current.pinchDistance;
          const center = midpoint(first!, second!);
          zoomAtPoint(targetScale, center.x, center.y);
          gestureMetaRef.current.moved = true;
          gestureMetaRef.current.velocityX = 0;
          gestureMetaRef.current.velocityY = 0;
          gestureMetaRef.current.suppressClickUntil = performance.now() + 280;
          return;
        }

        const deltaX = snapshot.x - snapshot.startX;
        const deltaY = snapshot.y - snapshot.startY;
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          gestureMetaRef.current.moved = true;
        }

        if (stateRef.current.scale <= fitScaleRef.current + 0.001) return;
        if (!gestureMetaRef.current.moved) return;

        const now = performance.now();
        const elapsed = Math.max(16, now - gestureMetaRef.current.lastMoveAt);
        const rawTx = gestureMetaRef.current.panOriginTx + deltaX;
        const rawTy = gestureMetaRef.current.panOriginTy + deltaY;
        const next = applyResistance(stateRef.current.scale, rawTx, rawTy);
        gestureMetaRef.current.velocityX = (next.tx - stateRef.current.tx) / elapsed;
        gestureMetaRef.current.velocityY = (next.ty - stateRef.current.ty) / elapsed;
        gestureMetaRef.current.lastMoveAt = now;
        applyTransform({
          scale: stateRef.current.scale,
          tx: next.tx,
          ty: next.ty,
          mode: "panning",
        });
        gestureMetaRef.current.suppressClickUntil = performance.now() + 280;
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        const snapshot = pointersRef.current.get(event.pointerId);
        const wasTap =
          snapshot &&
          Math.abs(snapshot.x - snapshot.startX) < 8 &&
          Math.abs(snapshot.y - snapshot.startY) < 8;
        pointersRef.current.delete(event.pointerId);
        try {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          /* ignore */
        }

        if (pointersRef.current.size === 0) {
          applyTransform({ ...stateRef.current, mode: "idle" });
          if (gestureMetaRef.current.moved && event.pointerType !== "mouse") {
            startFling();
          } else {
            settleIntoBounds();
          }
        } else if (pointersRef.current.size === 1) {
          gestureMetaRef.current.panOriginTx = stateRef.current.tx;
          gestureMetaRef.current.panOriginTy = stateRef.current.ty;
          applyTransform({ ...stateRef.current, mode: "idle" });
        }

        if (event.pointerType === "touch" && wasTap) {
          const now = performance.now();
          if (
            shouldTriggerDoubleTapZoom({
              now,
              lastTapAt: gestureMetaRef.current.lastTapAt,
              x: event.clientX,
              y: event.clientY,
              lastTapX: gestureMetaRef.current.lastTapX,
              lastTapY: gestureMetaRef.current.lastTapY,
            })
          ) {
            const currentScale = stateRef.current.scale;
            const targetScale =
              currentScale > fitScaleRef.current + 0.08
                ? fitScaleRef.current
                : Math.min(
                    Math.max(maxScale, fitScaleRef.current * 2.75),
                    fitScaleRef.current * 1.9,
                  );
            applySurfaceTransition("transform 200ms cubic-bezier(0.23, 1, 0.32, 1)");
            zoomAtPoint(targetScale, event.clientX, event.clientY);
            gestureMetaRef.current.suppressClickUntil = performance.now() + 340;
            gestureMetaRef.current.lastTapX = null;
            gestureMetaRef.current.lastTapY = null;
            gestureMetaRef.current.lastTapAt = 0;
            return;
          }
          gestureMetaRef.current.lastTapAt = now;
          gestureMetaRef.current.lastTapX = event.clientX;
          gestureMetaRef.current.lastTapY = event.clientY;
        }
      },
      onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
        stopFling();
        pointersRef.current.delete(event.pointerId);
        try {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          /* ignore */
        }
        applyTransform({ ...stateRef.current, mode: "idle" });
        settleIntoBounds();
      },
    }),
    [
      applyResistance,
      applySurfaceTransition,
      applyTransform,
      maxScale,
      settleIntoBounds,
      startFling,
      stopFling,
      zoomAtPoint,
    ],
  );

  return {
    fitScaleRef,
    resetView,
    surfaceRef,
    viewportRef,
    viewportHandlers: handlers,
  };
}
