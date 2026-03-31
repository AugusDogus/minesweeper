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
  const gestureMetaRef = useRef({
    moved: false,
    suppressClickUntil: 0,
    panOriginTx: 0,
    panOriginTy: 0,
    pinchDistance: 0,
    pinchScale: 1,
    lastTapAt: 0,
  });

  const applyTransform = useCallback((nextState: ViewportState) => {
    stateRef.current = nextState;
    if (surfaceRef.current) {
      surfaceRef.current.style.transform = `translate3d(${nextState.tx}px, ${nextState.ty}px, 0) scale(${nextState.scale})`;
    }
  }, []);

  const clampTransform = useCallback(
    (scale: number, tx: number, ty: number) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return { tx, ty };
      }
      const rect = viewport.getBoundingClientRect();
      const scaledWidth = contentWidth * scale;
      const scaledHeight = contentHeight * scale;
      const minTx = Math.min(0, rect.width - scaledWidth);
      const maxTx = scaledWidth <= rect.width ? (rect.width - scaledWidth) / 2 : 0;
      const minTy = Math.min(0, rect.height - scaledHeight);
      const maxTy = scaledHeight <= rect.height ? (rect.height - scaledHeight) / 2 : 0;
      return {
        tx: clamp(tx, minTx, maxTx),
        ty: clamp(ty, minTy, maxTy),
      };
    },
    [contentHeight, contentWidth],
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
      const nextScale = clamp(targetScale, fitScaleRef.current, maxScale);
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
    fitScaleRef.current = Math.min(1, fitScale);
    const scale = fitScaleRef.current;
    const tx = (rect.width - contentWidth * scale) / 2;
    const ty = (rect.height - contentHeight * scale) / 2;
    applyTransform({ scale, tx, ty, mode: "idle" });
  }, [applyTransform, contentHeight, contentWidth]);

  useLayoutEffect(() => {
    resetView();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      resetView();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [resetKey, resetView]);

  const handlers = useMemo(
    () => ({
      onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => {
        if (gestureMetaRef.current.suppressClickUntil > performance.now()) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
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

        const rawTx = gestureMetaRef.current.panOriginTx + deltaX;
        const rawTy = gestureMetaRef.current.panOriginTy + deltaY;
        const clamped = clampTransform(stateRef.current.scale, rawTx, rawTy);
        applyTransform({
          scale: stateRef.current.scale,
          tx: clamped.tx,
          ty: clamped.ty,
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
        } else if (pointersRef.current.size === 1) {
          gestureMetaRef.current.panOriginTx = stateRef.current.tx;
          gestureMetaRef.current.panOriginTy = stateRef.current.ty;
          applyTransform({ ...stateRef.current, mode: "idle" });
        }

        if (event.pointerType === "touch" && wasTap) {
          const now = performance.now();
          if (now - gestureMetaRef.current.lastTapAt < 260) {
            const currentScale = stateRef.current.scale;
            const targetScale =
              currentScale > fitScaleRef.current + 0.08
                ? fitScaleRef.current
                : Math.min(maxScale, Math.max(fitScaleRef.current * 1.8, 1.8));
            zoomAtPoint(targetScale, event.clientX, event.clientY);
            gestureMetaRef.current.suppressClickUntil = performance.now() + 340;
          }
          gestureMetaRef.current.lastTapAt = now;
        }
      },
      onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
        pointersRef.current.delete(event.pointerId);
        try {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          /* ignore */
        }
        applyTransform({ ...stateRef.current, mode: "idle" });
      },
    }),
    [applyTransform, clampTransform, maxScale, zoomAtPoint],
  );

  return {
    fitScaleRef,
    resetView,
    surfaceRef,
    viewportRef,
    viewportHandlers: handlers,
  };
}
