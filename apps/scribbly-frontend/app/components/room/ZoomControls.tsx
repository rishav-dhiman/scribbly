"use client";

// 🔍 Bottom-left zoom cluster for the infinite desk — the same sticker styling
// as the tool rail. Engine handles come in as plain callbacks so this stays
// a dumb presentational piece.
interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const BTN =
  "flex h-7 w-7 items-center justify-center rounded-md font-mono text-xs text-[#26234f] transition-colors hover:bg-[#6965db]/10 active:scale-95 dark:text-zinc-300 dark:hover:bg-white/10";

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-0.5 rounded-xl border border-[#e6dcc0] bg-[#fffdf6]/95 p-1 shadow-[3px_3px_0_0_rgba(38,35,79,0.15)] backdrop-blur dark:border-white/10 dark:bg-[#101013]/95 dark:shadow-[3px_3px_0_0_rgba(0,0,0,0.8)]">
      <button type="button" title="Zoom out" onClick={onZoomOut} className={BTN}>
        −
      </button>
      {/* 📊 Clicking the percentage snaps back to 100% */}
      <button
        type="button"
        title="Reset zoom"
        onClick={onReset}
        className="min-w-11 rounded-md px-1.5 py-1 text-center font-mono text-[11px] text-[#26234f]/80 transition-colors hover:bg-[#6965db]/10 dark:text-zinc-300 dark:hover:bg-white/10"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" title="Zoom in" onClick={onZoomIn} className={BTN}>
        +
      </button>
    </div>
  );
}
