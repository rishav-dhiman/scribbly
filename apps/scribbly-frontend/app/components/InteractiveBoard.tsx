"use client";

import { useEffect, useRef, useState } from "react";

type Tool = "select" | "rect" | "ellipse" | "arrow" | "draw";

type Shape =
  | { id: number; kind: "rect" | "ellipse"; x: number; y: number; w: number; h: number }
  | { id: number; kind: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { id: number; kind: "draw"; points: { x: number; y: number }[] };

// 🖍️ The real tool rail — shortcuts match the ones a whiteboard user expects
const tools: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
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
    id: "arrow",
    label: "Arrow",
    key: "A",
    icon: <path d="M5 19 19 5M19 5h-8M19 5v8" />,
  },
  {
    id: "draw",
    label: "Draw",
    key: "P",
    icon: <path d="M4 15c3-7 6 7 9 0s5-7 7 0" />,
  },
];

const shortcuts: Record<string, Tool> = {
  v: "select",
  r: "rect",
  o: "ellipse",
  a: "arrow",
  p: "draw",
};

function StickyNote({
  text,
  tone,
  className,
}: {
  text: string;
  tone: "violet" | "amber";
  className: string;
}) {
  // 📌 Notes are draggable so the board behaves like a board, not an image
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  const tones =
    tone === "violet"
      ? "border-violet-300/40 bg-[#c9c6ff] text-[#26234f]"
      : "border-amber-300/50 bg-[#f3e3a3] text-[#3f3310]";

  return (
    <button
      type="button"
      draggable={false}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setOffset({
          x: drag.current.ox + e.clientX - drag.current.x,
          y: drag.current.oy + e.clientY - drag.current.y,
        });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className={`absolute cursor-grab touch-none rounded-sm border px-2.5 py-1 font-hand text-base font-semibold shadow-lg select-none transition-shadow active:cursor-grabbing active:shadow-xl ${tones} ${className}`}
    >
      {text}
    </button>
  );
}

export function InteractiveBoard() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const draftRef = useRef<Shape | null>(null);
  const nextId = useRef(1);

  const [tool, setTool] = useState<Tool>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  // 🖱️ Your own cursor, rendered the way the room renders everyone else's
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // ⌨️ V / R / O / A / P switch tools, Esc drops back to select
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const next = shortcuts[e.key.toLowerCase()];
      if (next) setTool(next);
      if (e.key === "Escape") setTool("select");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 🎯 Map screen pixels into the board's own coordinate system
  function toBoardPoint(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const mapped = point.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: mapped.x, y: mapped.y };
  }

  function track(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function begin(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === "select") return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = toBoardPoint(e);
    start.current = p;
    const id = nextId.current;

    const shape: Shape =
      tool === "draw"
        ? { id, kind: "draw", points: [p] }
        : tool === "arrow"
          ? { id, kind: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y }
          : { id, kind: tool, x: p.x, y: p.y, w: 0, h: 0 };

    draftRef.current = shape;
    setDraft(shape);
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    if (!drawing.current) return;
    const current = draftRef.current;
    if (!current) return;
    const p = toBoardPoint(e);

    let next: Shape = current;
    if (current.kind === "draw")
      next = { ...current, points: [...current.points, p] };
    else if (current.kind === "arrow")
      next = { ...current, x2: p.x, y2: p.y };
    else
      next = {
        ...current,
        x: Math.min(start.current.x, p.x),
        y: Math.min(start.current.y, p.y),
        w: Math.abs(p.x - start.current.x),
        h: Math.abs(p.y - start.current.y),
      };

    draftRef.current = next;
    setDraft(next);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;

    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current) return;

    const bigEnough =
      current.kind === "draw"
        ? current.points.length > 4
        : current.kind === "arrow"
          ? Math.hypot(current.x2 - current.x1, current.y2 - current.y1) > 12
          : current.w > 8 && current.h > 8;

    if (bigEnough) {
      nextId.current += 1;
      setShapes((prev) => [...prev, current]);
      setHasDrawn(true);
    }
  }

  const drawingActive = tool !== "select";

  return (
    <div className="relative">
      {/* 🪟 Board chrome: the same frame the room uses, not a browser mockup */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e] shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] tracking-wide text-zinc-400">
              room-no-1
            </span>
            <span className="hidden font-mono text-[10px] text-zinc-600 sm:inline">
              / untitled-board
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 font-mono text-[10px] text-emerald-300/90 sm:flex">
              <span className="animate-pulse-soft h-1.5 w-1.5 rounded-full bg-emerald-400" />
              2 online
            </span>
            <div className="flex -space-x-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6965db] text-[9px] font-semibold text-white ring-2 ring-[#0c0c0e]">
                Y
              </span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-semibold text-zinc-950 ring-2 ring-[#0c0c0e]">
                R
              </span>
            </div>
          </div>
        </div>

        <div className="relative h-95 sm:h-115 lg:h-130">
          {/* · the dot grid is the board itself */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)] bg-size-[18px_18px]" />

          <svg
            ref={svgRef}
            viewBox="0 0 640 520"
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={begin}
            onPointerMove={(e) => {
              track(e);
              move(e);
            }}
            onPointerUp={end}
            onPointerCancel={end}
            onPointerLeave={() => setCursor(null)}
            className={`absolute inset-0 h-full w-full ${
              drawingActive ? "cursor-crosshair touch-none" : "touch-pan-y"
            }`}
          >
            <defs>
              <marker
                id="ink-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#8b8b95" />
              </marker>
              <marker
                id="user-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#b9b5ff" />
              </marker>
            </defs>

            {/* ✒️ Authored scene — draws itself on load */}
            <g
              fill="none"
              stroke="#8b8b95"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect
                pathLength={1}
                className="ink"
                x="64"
                y="60"
                width="176"
                height="82"
                rx="10"
              />
              <rect
                pathLength={1}
                className="ink"
                style={{ animationDelay: "0.35s" }}
                x="396"
                y="200"
                width="184"
                height="82"
                rx="10"
              />
              <rect
                pathLength={1}
                className="ink"
                style={{ animationDelay: "0.7s" }}
                x="200"
                y="370"
                width="196"
                height="82"
                rx="10"
              />

              <path
                pathLength={1}
                className="ink"
                style={{ animationDelay: "1s" }}
                d="M240 101 C 306 101, 340 206, 390 230"
                markerEnd="url(#ink-arrow)"
              />
              <path
                pathLength={1}
                className="ink"
                style={{ animationDelay: "1.2s" }}
                d="M488 282 C 488 328, 436 350, 412 366"
                markerEnd="url(#ink-arrow)"
              />

              {/* violet accents on the authored scene */}
              <path
                pathLength={1}
                className="ink"
                style={{ animationDelay: "1.4s", stroke: "#8b87f5" }}
                d="M74 462 q 30 -20 60 0 t 60 0"
              />
              <path
                pathLength={1}
                className="ink"
                style={{ animationDelay: "1.5s", stroke: "#8b87f5" }}
                d="M560 80 l 7 14 14 7 -14 7 -7 14 -7 -14 -14 -7 14 -7 z"
              />
            </g>

            <g
              fill="#d4d4d8"
              fontSize="14"
              fontFamily="ui-sans-serif, system-ui"
            >
              <text x="116" y="107">
                User
              </text>
              <text x="456" y="247">
                Room
              </text>
              <text x="258" y="417">
                Canvas
              </text>
            </g>

            {/* ✏️ Everything the visitor draws lives in violet */}
            <g
              fill="none"
              stroke="#b9b5ff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {shapes.map((shape) => (
                <ShapeNode key={shape.id} shape={shape} />
              ))}
              {draft && <ShapeNode shape={draft} />}
            </g>
          </svg>

          {/* 🧰 Floating tool rail with real shortcuts */}
          <div className="absolute top-1/2 left-3 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-lg border border-white/10 bg-[#101013]/90 p-1.5 shadow-xl backdrop-blur">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={`${t.label} (${t.key})`}
                aria-label={`${t.label} tool`}
                aria-pressed={tool === t.id}
                onClick={() => setTool(t.id)}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  tool === t.id
                    ? "bg-[#6965db] text-white"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
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
                  {t.icon}
                </svg>
              </button>
            ))}
          </div>

          {/* 📌 Two notes you can move around */}
          <StickyNote
            text="ship it"
            tone="violet"
            className="top-[16%] right-[12%] -rotate-3"
          />
          <StickyNote
            text="v2, maybe?"
            tone="amber"
            className="right-[26%] bottom-[20%] rotate-2"
          />

          {/* 🖱️ Riya wanders on her own; your cursor follows the real pointer */}
          <div className="cursor-b absolute top-[30%] right-[34%] z-10 flex items-start gap-0.5">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 text-emerald-300"
              fill="currentColor"
            >
              <path d="M3 2l7.5 18 2.3-7.4L20 10.3z" />
            </svg>
            <span className="rounded bg-emerald-500 px-1.5 py-0.5 font-mono text-[10px] text-emerald-950">
              riya
            </span>
          </div>

          {cursor && (
            <div
              className="pointer-events-none absolute z-20 flex items-start gap-0.5"
              style={{ left: cursor.x + 12, top: cursor.y + 12 }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 text-violet-200"
                fill="currentColor"
              >
                <path d="M3 2l7.5 18 2.3-7.4L20 10.3z" />
              </svg>
              <span className="rounded bg-[#6965db] px-1.5 py-0.5 font-mono text-[10px] text-white">
                you
              </span>
            </div>
          )}

          {/* 🧭 Board status bar */}
          <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#101013]/90 px-1.5 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur">
              <span className="px-1.5">100%</span>
              <span className="h-3 w-px bg-white/10" />
              <span className="px-1.5 text-zinc-500">
                x 0 · y 0
              </span>
            </div>

            {!hasDrawn && (
              <span className="-rotate-2 rounded-sm border border-amber-300/60 bg-[#f3e3a3] px-3 py-1 font-hand text-base font-semibold text-[#3f3310] shadow-lg">
                go on, draw something
              </span>
            )}

            <button
              type="button"
              onClick={() => setShapes([])}
              disabled={shapes.length === 0}
              className="rounded-lg border border-white/10 bg-[#101013]/90 px-2 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur transition-colors hover:text-zinc-100 disabled:opacity-40"
            >
              clear
            </button>
          </div>
        </div>
      </div>

      {/* 🏷️ Small caption outside the frame */}
      <div className="mt-3 flex items-center justify-between font-hand text-lg text-zinc-500">
        <span>this one&rsquo;s real — draw on it</span>
        <span className="hidden font-mono text-[10px] tracking-[0.2em] text-zinc-600 sm:inline">
          V · R · O · A · P
        </span>
      </div>
    </div>
  );
}

function ShapeNode({ shape }: { shape: Shape }) {
  if (shape.kind === "draw") {
    const d = shape.points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    return <path d={d} />;
  }

  if (shape.kind === "arrow")
    return (
      <line
        x1={shape.x1}
        y1={shape.y1}
        x2={shape.x2}
        y2={shape.y2}
        markerEnd="url(#user-arrow)"
      />
    );

  if (shape.kind === "ellipse")
    return (
      <ellipse
        cx={shape.x + shape.w / 2}
        cy={shape.y + shape.h / 2}
        rx={shape.w / 2}
        ry={shape.h / 2}
      />
    );

  return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx="6" />;
}
