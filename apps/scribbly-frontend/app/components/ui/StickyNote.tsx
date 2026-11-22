"use client";

import { useRef, useState, type ReactNode } from "react";

// 📌 A sticky note you can drag around — pointer-capture drag, used on the
// landing board, auth pages, and the room lobby wall.
export function StickyNote({
  children,
  color = "#f3e3a3",
  rotate = 2,
  draggable = true,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  rotate?: number;
  draggable?: boolean;
  className?: string;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(
    null,
  );

  function onPointerDown(e: React.PointerEvent<HTMLSpanElement>) {
    if (!draggable) return;
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + e.clientX - drag.current.px,
      y: drag.current.oy + e.clientY - drag.current.py,
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  return (
    <span
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
        backgroundColor: color,
      }}
      className={`cursor-grab touch-none select-none border border-amber-300/60 px-2.5 py-1 font-hand text-base font-semibold text-[#3f3310] shadow-lg active:cursor-grabbing ${className}`}
    >
      {children}
    </span>
  );
}
