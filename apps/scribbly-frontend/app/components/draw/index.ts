import axios from "axios";
import rough from "roughjs";
import { BACKEND_URL } from "@/app/config";

// A new tool needs an entry here plus a branch in toDrawables and the drag math.
export type Tool =
  | "select"
  | "rect"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line"
  | "draw"
  | "text"
  | "note";

// Stored as JSON in the `shape` column and sent as JSON on the wire.
// Coordinates are world coordinates, so the camera alone decides where a
// shape lands on screen. `style` is per-shape so every client renders what
// the author chose; shapes stored before the style toggle render as "rough".
export type LineStyle = "rough" | "solid";

export type NoteColor = "yellow" | "violet" | "green";

export type Shape =
  | { type: "rect"; x: number; y: number; width: number; height: number; style?: LineStyle }
  | { type: "ellipse"; x: number; y: number; width: number; height: number; style?: LineStyle }
  | { type: "diamond"; x: number; y: number; width: number; height: number; style?: LineStyle }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; style?: LineStyle }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; style?: LineStyle }
  // x,y is the text baseline, not the top edge.
  | { type: "text"; x: number; y: number; text: string }
  // Paper hugs its words: width/height come from measured font metrics.
  // `color` is optional because notes stored before the swatches lack it.
  | {
      type: "note";
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      color?: NoteColor;
    }
  | { type: "draw"; points: { x: number; y: number }[]; style?: LineStyle };

// The canvas is transparent; the paper desk under it is CSS.
const INK = "#6965db";

// Below these thresholds a gesture is a click, not a shape.
const MIN_SIZE = 8;
const MIN_ARROW_LEN = 12;
const MIN_POINTS = 4;
// Dropping near-duplicate points keeps freehand packets under the server's
// 4000-char limit.
const MIN_POINT_GAP = 3;
// Width is estimated per character so hit-testing and the marquee never need
// to measure text; multi-line height follows the line count.
const TEXT_SIZE = 28;
const TEXT_LINE_H = TEXT_SIZE * 1.15;
function textWidth(text: string) {
  return Math.max(...text.split("\n").map((line) => line.length)) * TEXT_SIZE * 0.5;
}
function textHeight(text: string) {
  return TEXT_SIZE + (text.split("\n").length - 1) * TEXT_LINE_H;
}
// Notes measure the real Caveat font, wrap at a max width, then size the paper
// around the widest line.
const NOTE_MIN_W = 120;
const NOTE_MAX_W = 280;
export const NOTE_PAD = 14;
export const NOTE_TEXT_SIZE = 24;
const NOTE_LINE_H = NOTE_TEXT_SIZE * 1.15;
const NOTE_FILL = "#f3e3a3";
// Yellow follows the theme palette; these two tones are fixed.
const NOTE_TONES: Record<Exclude<NoteColor, "yellow">, { paper: string; ink: string }> = {
  violet: { paper: "#c9c6ff", ink: "#26234f" },
  green: { paper: "#c3e6c0", ink: "#1f3a24" },
};

function wrapNote(text: string, maxWidth: number, measure: (s: string) => number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && measure(test) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}
export type NoteShape = Extract<Shape, { type: "note" }>;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

type Camera = { offsetX: number; offsetY: number; zoom: number };

type EngineOptions = {
  roomId: number; // only used to fetch history; sending goes through emit
  // React hands over send closures so it decides when emitting is safe
  // (for example, only after the join confirms); the engine stays socket-free.
  emit: (shapeJson: string) => void;
  // Erase packets carry the shape's own JSON, since content addressing has no ids.
  emitErase: (shapeJson: string) => void;
  // Getters keep initDraw single-shot: React state changes never re-init the engine.
  getTool: () => Tool;
  getLineStyle: () => LineStyle;
  getNoteColor: () => NoteColor;
  // Camera changes let React label the zoom control and project remote cursors.
  onCamera?: (camera: Camera) => void;
  onCursorMove?: (world: { x: number; y: number }) => void;
  onSelection?: (hasSelection: boolean) => void;
  // Text and note overlays are DOM inputs hosted by React at the reported spot.
  onTextRequest?: (world: { x: number; y: number }, screen: { x: number; y: number }) => void;
  // `created` tells the commit whether the note is new or already persisted.
  onNoteRequest?: (
    note: NoteShape,
    screen: { x: number; y: number },
    created: boolean,
  ) => void;
};

// Rough.js jitters randomly unless seeded. Hashing the shape's own JSON makes
// every client sketch the same wobble for the same shape, with no wire change.
function seedFor(shape: Shape) {
  const json = JSON.stringify(shape);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// `pad` is in world units; a note counts anywhere inside its paper.
function hitTest(shape: Shape, p: { x: number; y: number }, pad: number) {
  if (shape.type === "note") {
    return (
      p.x >= shape.x - pad &&
      p.x <= shape.x + shape.width + pad &&
      p.y >= shape.y - pad &&
      p.y <= shape.y + shape.height + pad
    );
  }
  if (shape.type === "rect" || shape.type === "diamond") {
    return (
      p.x >= shape.x - pad &&
      p.x <= shape.x + shape.width + pad &&
      p.y >= shape.y - pad &&
      p.y <= shape.y + shape.height + pad
    );
  }
  if (shape.type === "ellipse") {
    const rx = Math.abs(shape.width) / 2 + pad;
    const ry = Math.abs(shape.height) / 2 + pad;
    const nx = (p.x - (shape.x + shape.width / 2)) / rx;
    const ny = (p.y - (shape.y + shape.height / 2)) / ry;
    return nx * nx + ny * ny <= 1;
  }
  if (shape.type === "arrow" || shape.type === "line") {
    return (
      distToSegment(p.x, p.y, shape.x1, shape.y1, shape.x2, shape.y2) <= pad
    );
  }
  if (shape.type === "text") {
    return (
      p.x >= shape.x - pad &&
      p.x <= shape.x + textWidth(shape.text) + pad &&
      p.y >= shape.y - TEXT_SIZE - pad &&
      p.y <= shape.y - TEXT_SIZE + textHeight(shape.text) + pad
    );
  }
  for (let i = 1; i < shape.points.length; i++) {
    if (
      distToSegment(
        p.x,
        p.y,
        shape.points[i - 1].x,
        shape.points[i - 1].y,
        shape.points[i].x,
        shape.points[i].y,
      ) <= pad
    ) {
      return true;
    }
  }
  return false;
}

function translate(shape: Shape, dx: number, dy: number): Shape {
  if (
    shape.type === "rect" ||
    shape.type === "ellipse" ||
    shape.type === "diamond" ||
    shape.type === "note"
  ) {
    return { ...shape, x: shape.x + dx, y: shape.y + dy };
  }
  if (shape.type === "arrow" || shape.type === "line") {
    return {
      ...shape,
      x1: shape.x1 + dx,
      y1: shape.y1 + dy,
      x2: shape.x2 + dx,
      y2: shape.y2 + dy,
    };
  }
  if (shape.type === "text") {
    return { ...shape, x: shape.x + dx, y: shape.y + dy };
  }
  return {
    ...shape,
    points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

function bounds(shape: Shape) {
  if (
    shape.type === "rect" ||
    shape.type === "ellipse" ||
    shape.type === "diamond" ||
    shape.type === "note"
  ) {
    return { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
  }
  if (shape.type === "arrow" || shape.type === "line") {
    return {
      x: Math.min(shape.x1, shape.x2),
      y: Math.min(shape.y1, shape.y2),
      w: Math.abs(shape.x2 - shape.x1),
      h: Math.abs(shape.y2 - shape.y1),
    };
  }
  if (shape.type === "text") {
    return {
      x: shape.x,
      y: shape.y - TEXT_SIZE,
      w: textWidth(shape.text),
      h: textHeight(shape.text),
    };
  }
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// Owns the canvas loop, camera and draft state; React wires it to the DOM.
// Returns handles for remote shapes, deletion, overlays and zoom.
export function initDraw(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  {
    roomId,
    emit,
    emitErase,
    getTool,
    getLineStyle,
    getNoteColor,
    onCamera,
    onCursorMove,
    onSelection,
    onTextRequest,
    onNoteRequest,
  }: EngineOptions,
) {
  let existingShapes: Shape[] = [];
  let selected: Shape | null = null;
  let clicked = false;
  let startX = 0;
  let startY = 0;
  let draftPoints: { x: number; y: number }[] = [];
  let draftShape: Shape | null = null;
  let panning = false;
  let panStart = { sx: 0, sy: 0, ox: 0, oy: 0 };
  // The original stays untouched because its JSON is the erase key; `current`
  // is the translated copy living on the board.
  let moving: { orig: Shape; origJson: string; current: Shape } | null = null;
  // Live auto-sizing mutates the card, so keep the pristine size and JSON;
  // the old JSON is the erase key.
  let editingNote: { note: NoteShape; orig: NoteShape; origJson: string } | null = null;

  const camera: Camera = { offsetX: 80, offsetY: 80, zoom: 1 };
  const gen = rough.generator();

  // Palette comes from CSS custom properties (.theme-light/.theme-dark).
  // Cached because redraw runs on every drag frame; refreshTheme() re-reads it.
  let palette = {
    ink: INK,
    note: NOTE_FILL,
    noteInk: INK,
    select: "#e0393e",
    shadow: "rgba(38,35,79,0.18)",
  };
  function readPalette() {
    const css = getComputedStyle(canvas);
    const read = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    palette = {
      ink: read("--board-ink", INK),
      note: read("--board-note", NOTE_FILL),
      noteInk: read("--board-note-ink", INK),
      select: read("--board-select", "#e0393e"),
      shadow: read("--board-note-shadow", "rgba(38,35,79,0.18)"),
    };
  }
  readPalette();
  onCamera?.(camera);

  function dpr() {
    return window.devicePixelRatio || 1;
  }

  function redraw() {
    const scale = dpr() * camera.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      camera.offsetX * dpr(),
      camera.offsetY * dpr(),
    );

    const rc = rough.canvas(canvas);
    // 2/zoom keeps stroke weight constant on screen at any zoom. roughness 1 +
    // bowing 0 is Excalidraw's recipe: one confident wobbly line instead of
    // scratchy retraced strokes.
    const base = { stroke: palette.ink, strokeWidth: 2 / camera.zoom, roughness: 1, bowing: 0 };
    // "solid" is the same Rough.js pipeline at roughness 0.
    const styleFor = (shape: Shape) => ({
      ...base,
      seed: seedFor(shape),
      // "style" in shape narrows away the text variant, which has no style field
      roughness: "style" in shape && shape.style === "solid" ? 0 : 1,
    });

    for (const shape of existingShapes) {
      // A note is an object, not ink: solid paper, shadow, text clipped inside.
      if (shape.type === "note") {
        const tone = shape.color && shape.color !== "yellow" ? NOTE_TONES[shape.color] : null;
        ctx.save();
        ctx.shadowColor = palette.shadow;
        ctx.shadowBlur = 14 / camera.zoom;
        ctx.shadowOffsetY = 5 / camera.zoom;
        ctx.fillStyle = tone?.paper ?? palette.note;
        ctx.beginPath();
        ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 6);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(38,35,79,0.35)";
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 6);
        ctx.clip();
        // While the textarea overlay is open it is the lettering; painting the
        // stored text underneath would double it and ghost an empty note.
        if (!(editingNote && editingNote.note === shape)) {
          ctx.fillStyle = tone?.ink ?? palette.noteInk;
          ctx.font = `600 ${NOTE_TEXT_SIZE}px Caveat, cursive`;
          ctx.textBaseline = "alphabetic";
          const lines = wrapNote(
            shape.text,
            shape.width - NOTE_PAD * 2,
            (s) => ctx.measureText(s).width,
          );
          const maxLines = Math.max(
            1,
            Math.floor((shape.height - NOTE_PAD * 2) / NOTE_LINE_H),
          );
          lines.slice(0, maxLines).forEach((line, i) =>
            ctx.fillText(
              line,
              shape.x + NOTE_PAD,
              shape.y + NOTE_PAD + NOTE_TEXT_SIZE + i * NOTE_LINE_H,
            ),
          );
        }
        ctx.restore();
        continue;
      }
      // Text bypasses Rough.js: the Caveat hand font is the aesthetic.
      if (shape.type === "text") {
        ctx.save();
        ctx.fillStyle = palette.ink;
        ctx.font = `600 ${TEXT_SIZE}px Caveat, cursive`;
        ctx.textBaseline = "alphabetic";
        shape.text
          .split("\n")
          .forEach((line, i) => ctx.fillText(line, shape.x, shape.y + i * TEXT_LINE_H));
        ctx.restore();
        continue;
      }
      for (const d of toDrawables(shape, styleFor(shape))) rc.draw(d);
    }
    if (draftShape) {
      for (const d of toDrawables(draftShape, styleFor(draftShape))) rc.draw(d);
    }

    // Dashed marquee; widths scale with zoom so the screen size stays constant.
    if (selected) {
      const b = bounds(selected);
      const pad = 6 / camera.zoom;
      ctx.save();
      ctx.strokeStyle = palette.select;
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.restore();
    }
  }

  function toDrawables(shape: Shape, style: Parameters<typeof gen.rectangle>[4]) {
    if (shape.type === "rect") {
      return [gen.rectangle(shape.x, shape.y, shape.width, shape.height, style)];
    }
    if (shape.type === "ellipse") {
      return [
        gen.ellipse(
          shape.x + shape.width / 2,
          shape.y + shape.height / 2,
          Math.abs(shape.width),
          Math.abs(shape.height),
          style,
        ),
      ];
    }
    if (shape.type === "diamond") {
      return [
        gen.polygon(
          [
            [shape.x + shape.width / 2, shape.y],
            [shape.x + shape.width, shape.y + shape.height / 2],
            [shape.x + shape.width / 2, shape.y + shape.height],
            [shape.x, shape.y + shape.height / 2],
          ],
          style,
        ),
      ];
    }
    if (shape.type === "line") {
      return [
        gen.linearPath(
          [
            [shape.x1, shape.y1],
            [shape.x2, shape.y2],
          ],
          style,
        ),
      ];
    }
    if (shape.type === "text") return []; // painted with fillText in redraw
    if (shape.type === "note") return []; // painted as a filled card in redraw
    if (shape.type === "arrow") {
      // Shaft plus a V head, one continuous polyline so the seeded jitter
      // joins head and shaft.
      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      const head = 12;
      const wing = (side: number): [number, number] => [
        shape.x2 + head * Math.cos(angle + side),
        shape.y2 + head * Math.sin(angle + side),
      ];
      return [
        gen.linearPath(
          [
            [shape.x1, shape.y1],
            [shape.x2, shape.y2],
            wing(Math.PI * (5 / 6)),
            [shape.x2, shape.y2],
            wing(-Math.PI * (5 / 6)),
          ],
          style,
        ),
      ];
    }
    return [
      gen.linearPath(
        shape.points.map((p) => [p.x, p.y] as [number, number]),
        style,
      ),
    ];
  }

  function toScreen(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function toWorld(e: MouseEvent) {
    const s = toScreen(e);
    return {
      x: (s.x - camera.offsetX) / camera.zoom,
      y: (s.y - camera.offsetY) / camera.zoom,
    };
  }

  function noteScreen(note: NoteShape) {
    return {
      x: note.x * camera.zoom + camera.offsetX + NOTE_PAD * camera.zoom,
      y: note.y * camera.zoom + camera.offsetY + NOTE_PAD * camera.zoom,
    };
  }

  function noteSize(text: string) {
    ctx.save();
    ctx.font = `600 ${NOTE_TEXT_SIZE}px Caveat, cursive`;
    const measure = (s: string) => ctx.measureText(s).width;
    const lines = wrapNote(text, NOTE_MAX_W - NOTE_PAD * 2, measure);
    const widest = Math.max(...lines.map(measure));
    ctx.restore();
    return {
      // Round up: a fraction down makes the repaint wrap one word early and
      // the clipped word vanishes.
      width: Math.ceil(
        Math.min(NOTE_MAX_W, Math.max(NOTE_MIN_W, widest + NOTE_PAD * 2 + 1)),
      ),
      height: Math.ceil(lines.length * NOTE_LINE_H + NOTE_PAD * 2 + 6),
    };
  }

  function zoomAt(factor: number, screen?: { x: number; y: number }) {
    const anchor = screen ?? {
      x: canvas.clientWidth / 2,
      y: canvas.clientHeight / 2,
    };
    const world = {
      x: (anchor.x - camera.offsetX) / camera.zoom,
      y: (anchor.y - camera.offsetY) / camera.zoom,
    };
    camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
    camera.offsetX = anchor.x - world.x * camera.zoom;
    camera.offsetY = anchor.y - world.y * camera.zoom;
    redraw();
    onCamera?.(camera);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, toScreen(e));
    } else {
      camera.offsetX -= e.deltaX;
      camera.offsetY -= e.deltaY;
      redraw();
      onCamera?.(camera);
    }
  }

  function setSelected(shape: Shape | null) {
    selected = shape;
    onSelection?.(shape !== null);
    redraw();
  }

  function onDown(e: MouseEvent) {
    if (e.button === 1) {
      panning = true;
      const s = toScreen(e);
      panStart = { sx: s.x, sy: s.y, ox: camera.offsetX, oy: camera.offsetY };
      e.preventDefault();
      return;
    }
    // A note only persists once it has words; an untouched note is cancelled.
    if (getTool() === "note" && e.button === 0) {
      e.preventDefault();
      const p = toWorld(e);
      const size = noteSize("");
      editingNote = null;
      const note: NoteShape = {
        type: "note",
        x: p.x - size.width / 2,
        y: p.y - size.height / 2,
        width: size.width,
        height: size.height,
        text: "",
        color: getNoteColor(),
      };
      existingShapes.push(note);
      redraw();
      onNoteRequest?.(note, noteScreen(note), true);
      return;
    }
    if (getTool() === "select" && e.button === 0) {
      const p = toWorld(e);
      const pad = 8 / camera.zoom;
      for (let i = existingShapes.length - 1; i >= 0; i--) {
        const hit = existingShapes[i];
        if (hitTest(hit, p, pad)) {
          e.preventDefault();
          setSelected(hit);
          startX = p.x;
          startY = p.y;
          moving = { orig: hit, origJson: JSON.stringify(hit), current: hit };
          return;
        }
      }
      panning = true;
      const s = toScreen(e);
      panStart = { sx: s.x, sy: s.y, ox: camera.offsetX, oy: camera.offsetY };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    // preventDefault is required: without it the browser's focus shift fires
    // after the overlay mounts and blurs it, committing an empty string.
    if (getTool() === "text") {
      e.preventDefault();
      onTextRequest?.(toWorld(e), toScreen(e));
      return;
    }
    clicked = true;
    const p = toWorld(e);
    startX = p.x;
    startY = p.y;
    draftPoints = getTool() === "draw" ? [p] : [];
  }

  function onUp(e: MouseEvent) {
    // A real move is erase-old + draw-new, since content addressing has no ids;
    // a sub-2px wobble is undone so a click never rewrites the row.
    if (moving) {
      const m = moving;
      moving = null;
      const p = toWorld(e);
      const nudged = Math.hypot(p.x - startX, p.y - startY) * camera.zoom < 2;
      if (nudged && m.current !== m.orig) {
        const idx = existingShapes.indexOf(m.current);
        if (idx >= 0) existingShapes[idx] = m.orig;
      }
      selected = nudged ? m.orig : m.current;
      onSelection?.(true);
      redraw();
      if (!nudged && JSON.stringify(m.current) !== m.origJson) {
        emitErase(m.origJson);
        emit(JSON.stringify(m.current));
      }
      return;
    }
    if (panning) {
      panning = false;
      const s = toScreen(e);
      const moved = Math.hypot(s.x - panStart.sx, s.y - panStart.sy);
      if (getTool() === "select" && e.button === 0 && moved < 4) {
        setSelected(null);
      }
      return;
    }
    if (!clicked) return;
    clicked = false;
    const tool = getTool();
    const p = toWorld(e);

    // Normalised so width/height stay positive regardless of drag direction.
    let shape: Shape | null = null;
    if (tool === "rect" || tool === "ellipse" || tool === "diamond") {
      const width = Math.abs(p.x - startX);
      const height = Math.abs(p.y - startY);
      if (width > MIN_SIZE && height > MIN_SIZE) {
        shape = {
          type: tool,
          x: Math.min(startX, p.x),
          y: Math.min(startY, p.y),
          width,
          height,
          style: getLineStyle(),
        };
      }
    } else if (tool === "arrow" || tool === "line") {
      if (Math.hypot(p.x - startX, p.y - startY) > MIN_ARROW_LEN) {
        shape = { type: tool, x1: startX, y1: startY, x2: p.x, y2: p.y, style: getLineStyle() };
      }
    } else if (tool === "draw") {
      if (draftPoints.length > MIN_POINTS) {
        shape = { type: "draw", points: draftPoints, style: getLineStyle() };
      }
    }

    draftPoints = [];
    draftShape = null;
    if (!shape) {
      redraw(); // wipe the draft preview of a too-small gesture
      return;
    }

    existingShapes.push(shape);
    redraw();
    emit(JSON.stringify(shape));
  }

  function onMove(e: MouseEvent) {
    onCursorMove?.(toWorld(e));
    if (moving) {
      // Stop moving a ghost if the shape vanished remotely mid-drag.
      const idx = existingShapes.indexOf(moving.current);
      if (idx < 0) {
        moving = null;
        selected = null;
        onSelection?.(false);
        redraw();
        return;
      }
      // Translate the original by the total delta so offsets never accumulate.
      const p = toWorld(e);
      const next = translate(moving.orig, p.x - startX, p.y - startY);
      existingShapes[idx] = next;
      moving.current = next;
      selected = next;
      redraw();
      return;
    }
    if (panning) {
      const s = toScreen(e);
      camera.offsetX = panStart.ox + (s.x - panStart.sx);
      camera.offsetY = panStart.oy + (s.y - panStart.sy);
      redraw();
      onCamera?.(camera);
      return;
    }
    if (!clicked) return;
    const p = toWorld(e);
    const tool = getTool();

    if (tool === "rect" || tool === "ellipse" || tool === "diamond") {
      draftShape = {
        type: tool,
        x: Math.min(startX, p.x),
        y: Math.min(startY, p.y),
        width: Math.abs(p.x - startX),
        height: Math.abs(p.y - startY),
        style: getLineStyle(),
      };
    } else if (tool === "arrow" || tool === "line") {
      draftShape = { type: tool, x1: startX, y1: startY, x2: p.x, y2: p.y, style: getLineStyle() };
    } else if (tool === "draw") {
      const last = draftPoints[draftPoints.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_GAP) {
        draftPoints.push(p);
      }
      draftShape = { type: "draw", points: draftPoints, style: getLineStyle() };
    }
    redraw();
  }

  // Double-click reopens a note's overlay; anywhere else it plants a text box.
  function onDoubleClick(e: MouseEvent) {
    if (getTool() !== "select") return;
    const p = toWorld(e);
    const pad = 8 / camera.zoom;
    for (let i = existingShapes.length - 1; i >= 0; i--) {
      const shape = existingShapes[i];
      if (shape.type === "note" && hitTest(shape, p, pad)) {
        // Auto-sizing mutates the card, but the erase packet must carry the
        // JSON the server actually stored.
        editingNote = { note: shape, orig: { ...shape }, origJson: JSON.stringify(shape) };
        // Repaint before the overlay takes over so the stored text does not ghost.
        redraw();
        onNoteRequest?.(shape, noteScreen(shape), false);
        return;
      }
    }
    onTextRequest?.(p, toScreen(e));
  }

  // The backing store must follow CSS size × devicePixelRatio, or strokes
  // blur on hidpi screens.
  function resize() {
    const ratio = dpr();
    const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      redraw();
    }
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  canvas.addEventListener("mousedown", onDown);
  canvas.addEventListener("mouseup", onUp);
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("dblclick", onDoubleClick);
  // passive:false lets preventDefault work; React's onWheel cannot stop the
  // page from scroll-zooming out from under the board.
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // Fail-soft hydration: a dead backend still yields a drawable empty board.
  getExistingShapes(roomId)
    .then((shapes) => {
      existingShapes = shapes;
      redraw();
    })
    .catch(() => {
      console.warn("Shape history unavailable — starting with an empty board");
    });

  return {
    addRemoteShape(shape: Shape) {
      existingShapes.push(shape);
      redraw();
    },
    // Drop the newest matching instance, mirroring the server's delete.
    removeRemoteShape(shapeJson: string) {
      const jsons = existingShapes.map((s) => JSON.stringify(s));
      const idx = jsons.lastIndexOf(shapeJson);
      if (idx < 0) return;
      existingShapes.splice(idx, 1);
      if (selected && JSON.stringify(selected) === shapeJson) {
        selected = null;
        onSelection?.(false);
      }
      redraw();
    },
    deleteSelected() {
      if (!selected) return;
      const json = JSON.stringify(selected);
      const jsons = existingShapes.map((s) => JSON.stringify(s));
      const idx = jsons.lastIndexOf(json);
      if (idx >= 0) existingShapes.splice(idx, 1);
      setSelected(null);
      editingNote = null;
      emitErase(json);
    },
    hasSelection() {
      return selected !== null;
    },
    fitNote(note: NoteShape, text: string) {
      const editing = editingNote;
      const size =
        editing && editing.note === note && text.trim() === editing.orig.text
          ? { width: editing.orig.width, height: editing.orig.height }
          : noteSize(text);
      note.width = size.width;
      note.height = size.height;
      redraw();
    },
    cancelNoteEdit(note: NoteShape) {
      if (!editingNote || editingNote.note !== note) return;
      note.width = editingNote.orig.width;
      note.height = editingNote.orig.height;
      editingNote = null;
      redraw();
    },
    // A new note with no text is dropped without sending anything. Editing a
    // saved note is erase + draw, because the old JSON is the only key;
    // clearing a saved note deletes it.
    commitNote(note: NoteShape, text: string, created: boolean) {
      const clean = text.trim();
      const idx = existingShapes.indexOf(note);
      if (created) {
        if (!clean) {
          if (idx >= 0) existingShapes.splice(idx, 1);
          redraw();
          return;
        }
        const next: NoteShape = { ...note, ...noteSize(clean), text: clean };
        if (idx >= 0) existingShapes[idx] = next;
        redraw();
        emit(JSON.stringify(next));
        return;
      }
      if (!clean) {
        if (idx >= 0) existingShapes.splice(idx, 1);
        if (selected === note) setSelected(null);
        else redraw();
        emitErase(editingNote?.origJson ?? JSON.stringify(note));
        editingNote = null;
        return;
      }
      const next: NoteShape = { ...note, ...noteSize(clean), text: clean };
      if (idx >= 0) existingShapes[idx] = next;
      if (selected === note) selected = next;
      redraw();
      emitErase(editingNote?.origJson ?? JSON.stringify(note));
      editingNote = null;
      emit(JSON.stringify(next));
    },
    commitText(x: number, y: number, text: string) {
      const clean = text.trim();
      if (!clean) return;
      const shape: Shape = { type: "text", x, y, text: clean };
      existingShapes.push(shape);
      redraw();
      emit(JSON.stringify(shape));
    },
    // Shapes carry no theme data; a theme flip only changes the ink.
    refreshTheme() {
      readPalette();
      redraw();
    },
    zoomIn() {
      zoomAt(1.25);
    },
    zoomOut() {
      zoomAt(1 / 1.25);
    },
    resetZoom() {
      camera.zoom = 1;
      camera.offsetX = 80;
      camera.offsetY = 80;
      redraw();
      onCamera?.(camera);
    },
    cleanup() {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("wheel", onWheel);
      resizeObserver.disconnect();
    },
  };
}

export type EngineHandle = ReturnType<typeof initDraw>;

async function getExistingShapes(roomId: number): Promise<Shape[]> {
  const res = await axios.get(`${BACKEND_URL}/shapes/${roomId}`, {
    withCredentials: true,
  });
  return res.data.shapes.map((row: { shape: string }) => JSON.parse(row.shape));
}
