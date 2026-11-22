"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { LineStyle, NoteColor, Tool } from "../draw";

// ⌨️ Shortcut map — V·R·O·D·A·L·P·T, one letter per tool
export const SHORTCUTS: Record<string, Tool> = {
  v: "select",
  r: "rect",
  o: "ellipse",
  d: "diamond",
  a: "arrow",
  l: "line",
  p: "draw",
  t: "text",
  n: "note",
};

// 🧰 Tool dock — same tools and icons as the landing board, now a top-center
// floating pill in the Excalidraw position.
const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    key: "V",
    icon: <path d="M4 3l6.5 16 2-6.2L19 11z" />,
  },
  {
    id: "rect",
    label: "Rectangle",
    key: "R",
    icon: <rect x="4" y="4" width="16" height="16" rx="2.5" />,
  },
  {
    id: "ellipse",
    label: "Ellipse",
    key: "O",
    icon: <circle cx="12" cy="12" r="8" />,
  },
  {
    id: "diamond",
    label: "Diamond",
    key: "D",
    icon: <path d="M12 3l7.8 9L12 21l-7.8-9z" />,
  },
  {
    id: "arrow",
    label: "Arrow",
    key: "A",
    icon: <path d="M5 19 19 5M19 5h-8M19 5v8" />,
  },
  {
    id: "line",
    label: "Line",
    key: "L",
    icon: <path d="M6 18 18 6" />,
  },
  {
    id: "draw",
    label: "Draw",
    key: "P",
    icon: <path d="M4 15c3-7 6 7 9 0s5-7 7 0" />,
  },
  {
    id: "text",
    label: "Text",
    key: "T",
    icon: <path d="M5 5.5h14M12 5.5V20" />,
  },
  {
    // 📝 Square with a folded corner — the sticky note you click to place
    id: "note",
    label: "Sticky note",
    key: "N",
    icon: <path d="M5 4h10.5L20 8.5V20H5zM15.5 4v4.5H20" />,
  },
];

// 🎨 Paper swatches — shown right where the line-style toggle sits, but only
// while the note tool is active (rough vs solid means nothing for paper)
const NOTE_COLORS: { id: NoteColor; label: string; fill: string }[] = [
  { id: "yellow", label: "Yellow note", fill: "#f3e3a3" },
  { id: "violet", label: "Violet note", fill: "#c9c6ff" },
  { id: "green", label: "Green note", fill: "#c3e6c0" },
];

export function ToolBar({
  tool,
  onSelect,
  lineStyle,
  onLineStyle,
  noteColor,
  onNoteColor,
}: {
  tool: Tool;
  onSelect: (tool: Tool) => void;
  lineStyle: LineStyle;
  onLineStyle: (style: LineStyle) => void;
  noteColor: NoteColor;
  onNoteColor: (color: NoteColor) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -14, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="absolute top-3 left-1/2 z-10 flex items-center gap-0.5 rounded-2xl border border-[#26234f]/15 bg-[#fffdf6]/95 p-1 shadow-[0_12px_30px_-12px_rgba(38,35,79,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#101013]/95 dark:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)]"
    >
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={`${t.label} (${t.key})`}
          aria-pressed={tool === t.id}
          onClick={() => onSelect(t.id)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90 ${
            tool === t.id
              ? "bg-[#6965db] text-white shadow-[2px_2px_0_0_#26234f] dark:shadow-[2px_2px_0_0_#000]"
              : "text-[#26234f]/55 hover:bg-[#26234f]/5 hover:text-[#26234f] dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {t.icon}
          </svg>
        </button>
      ))}

      {/* ✒️ Line style — applies to the NEXT shape you draw; each shape keeps
          the style it was authored with, so the whole room stays consistent.
          📝 While the note tool is active this row becomes paper swatches. */}
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-[#26234f]/15 dark:bg-white/15" />
      {tool === "note"
        ? NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-pressed={noteColor === c.id}
              onClick={() => onNoteColor(c.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-90 ${
                noteColor === c.id
                  ? "bg-[#26234f]/10 ring-2 ring-[#6965db] dark:bg-white/10 dark:ring-[#b9b5ff]"
                  : "hover:bg-[#26234f]/5 dark:hover:bg-white/5"
              }`}
            >
              <span
                className="h-4 w-4 rounded-[3px] border border-[#26234f]/25 shadow-[1px_1px_0_0_rgba(38,35,79,0.35)]"
                style={{ backgroundColor: c.fill }}
              />
            </button>
          ))
        : (
            [
              { id: "rough", label: "Rough lines", icon: <path d="M4 12c2.5-5 5 5 8 0s5-5 8 0" /> },
              { id: "solid", label: "Solid lines", icon: <path d="M5 12h14" /> },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-pressed={lineStyle === s.id}
              onClick={() => onLineStyle(s.id)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-90 ${
                lineStyle === s.id
                  ? "bg-[#6965db] text-white shadow-[1px_1px_0_0_#26234f] dark:shadow-[1px_1px_0_0_#000]"
                  : "text-[#26234f]/55 hover:bg-[#26234f]/5 hover:text-[#26234f] dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {s.icon}
              </svg>
            </button>
          ))}
    </motion.div>
  );
}
