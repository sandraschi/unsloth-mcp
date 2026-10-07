import { useCallback, useEffect, useState } from "react";

export const ZOOM_LEVELS = [0.5, 0.6, 0.7, 0.8, 1.0, 1.25, 1.5, 2.0, 3.0];
const STORAGE_KEY = "tauri-zoom";

function nearestLevel(v: number): number {
  let best = ZOOM_LEVELS[0];
  for (const l of ZOOM_LEVELS) {
    if (Math.abs(l - v) < Math.abs(best - v)) best = l;
  }
  return best;
}

/** Fleet zoom: Ctrl+wheel steps through levels, Ctrl+0 resets, persisted. */
export function useZoom() {
  const [zoom, setZoom] = useState<number>(() => {
    try {
      return nearestLevel(Number(localStorage.getItem(STORAGE_KEY) ?? "1") || 1);
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    // CSS `zoom` fallback works in the dev browser; Tauri WebView honors it too.
    document.body.style.zoom = String(zoom);
    try {
      localStorage.setItem(STORAGE_KEY, String(zoom));
    } catch {
      /* private mode */
    }
    return () => {
      document.body.style.zoom = "";
    };
  }, [zoom]);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => {
        const i = ZOOM_LEVELS.indexOf(nearestLevel(z));
        const next =
          ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + (e.deltaY < 0 ? 1 : -1)))];
        return next;
      });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const resetZoom = useCallback(() => setZoom(1), []);
  return { zoom, setZoom, resetZoom };
}
