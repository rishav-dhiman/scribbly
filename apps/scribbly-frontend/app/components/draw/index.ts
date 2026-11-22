import axios from "axios";
import rough from "roughjs";
import { BACKEND_URL } from "@/app/config";

// 🧰 The tools the toolbar can select — the same set the landing board demos.
// A new tool = a new entry here plus a branch in genDraw / drag math.
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

// 🎨 One canvas element. This exact shape is what gets JSON.stringify'd onto
// the wire and stored in the Postgres `shape` column (see the Shape model).
// Coordinates are WORLD coordinates — the camera decides where they land on
// screen, which is what makes the board infinite.
// ✒️ `style` rides on the shape (not on a global setting) so every client renders
// exactly what the author chose; shapes from before the toggle have no field
// and render as "rough".
export type LineStyle = "rough" | "solid";

// 🎨 Sticky-note paper choices — the toolbar swaps the line-style toggle for
// these swatches while the note tool is active
export type NoteColor = "yellow" | "violet" | "green";

export type Shape =
  | { type: "rect"; x: number; y: number; width: number; height: number; style?: LineStyle }
  | { type: "ellipse"; x: number; y: number; width: number; height: number; style?: LineStyle }
  | { type: "diamond"; x: number; y: number; width: number; height: number; style?: LineStyle }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; style?: LineStyle }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; style?: LineStyle }
  // 🔤 x,y is the BASELINE origin (top-left-ish); rendered in the Caveat hand font
  | { type: "text"; x: number; y: number; text: string }
  // 📝 Sticky note: a filled paper card with wrapped text. x,y is its top-left;
  // the paper HUGS its words (sized from real font metrics) and `color` picks
  // one of the toolbar swatches. Notes from before the swatches have no field.
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

// 🖌️ The violet marker ink. No board fill here — the canvas is transparent
// and the paper desk (CSS) shows through.
const INK = "#6965db";

// 📦 Smallest commit-worthy gesture — below this a click is a click, not a shape
const MIN_SIZE = 8;
const MIN_ARROW_LEN = 12;
const MIN_POINTS = 4;
// 📏 Freehand sampling gap: points closer than this to the last one are skipped,
// which keeps polyline payloads small (the WS draw packet caps at 4000 chars)
const MIN_POINT_GAP = 3;
// 🔤 Hand-lettered text: one world-unit font size. Width is estimated per char
// so hit-test and the marquee work without measuring text on every redraw.
// Shift+Enter makes these multi-line, so height follows the line count too.
const TEXT_SIZE = 28;
const TEXT_LINE_H = TEXT_SIZE * 1.15;
function textWidth(text: string) {
  return Math.max(...text.split("\n").map((line) => line.length)) * TEXT_SIZE * 0.5;
}
function textHeight(text: string) {
  return TEXT_SIZE + (text.split("\n").length - 1) * TEXT_LINE_H;
}
// 📝 Sticky note paper — it HUGS its words like the landing board's notes:
// measure the real Caveat font, wrap at a max width, then size the card around
// the widest line. Height follows the line count.
const NOTE_MIN_W = 120;
const NOTE_MAX_W = 280;
export const NOTE_PAD = 14;
export const NOTE_TEXT_SIZE = 24;
const NOTE_LINE_H = NOTE_TEXT_SIZE * 1.15;
const NOTE_FILL = "#f3e3a3";
// 🎨 Paper tones: yellow reads from the theme palette, these two are fixed
const NOTE_TONES: Record<Exclude<NoteColor, "yellow">, { paper: string; ink: string }> = {
  violet: { paper: "#c9c6ff", ink: "#26234f" },
  green: { paper: "#c3e6c0", ink: "#1f3a24" },
};

// 🧵 Word-wrap by measured width — explicit newlines stay as paragraph breaks.
// Shared by the repaint and the auto-size pass so both agree on the layout.
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
// 🪪 Narrower view of the note variant, used by the overlay handoff
export type NoteShape = Extract<Shape, { type: "note" }>;
// 🔍 Zoom limits for the camera
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

// 📷 The camera: where world (0,0) sits on screen, and how much a world unit
// is magnified. Pan changes offset, zoom changes scale (anchored at cursor).
type Camera = { offsetX: number; offsetY: number; zoom: number };

type EngineOptions = {
  roomId: number; // used only to fetch history — SENDING goes through emit
  // 📤 React hands the engine a send-closure instead of the raw socket, so the
  // React layer decides when it's safe to emit (e.g. after the join confirms)
  emit: (shapeJson: string) => void;
  // 🧹 Same deal for erasing: the engine knows WHAT was deleted, React decides
  // WHEN it's safe to send (erase packets carry the shape's own JSON)
  emitErase: (shapeJson: string) => void;
  getTool: () => Tool;
  // ✒️ Current line style for NEW shapes — same ref trick as getTool, so the
  // toggle never forces the engine to re-init
  getLineStyle: () => LineStyle;
  // 🎨 Current sticky-note paper for NEW notes — same ref trick again
  getNoteColor: () => NoteColor;
  // 📢 The engine reports camera changes (pan or zoom) so React can label the
  // zoom control AND project remote cursors onto the screen
  onCamera?: (camera: Camera) => void;
  // 🖱️ Local pointer position in world coordinates — React throttles it onto
  // the wire; the engine stays socket-free
  onCursorMove?: (world: { x: number; y: number }) => void;
  // 🎯 Selection mirror — lets React show the delete button only when a
  // shape is actually selected
  onSelection?: (hasSelection: boolean) => void;
  // 🔤 Text tool handoff: the engine reports WHERE the user clicked (world +
  // screen), React hosts the DOM input there and calls commitText when done
  onTextRequest?: (world: { x: number; y: number }, screen: { x: number; y: number }) => void;
  // 📝 Note handoff: a click drops a note, a double-click edits one. `created`
  // tells the commit whether the note is brand new or already persisted
  onNoteRequest?: (
    note: NoteShape,
    screen: { x: number; y: number },
    created: boolean,
  ) => void;
};

// 🔑 Rough.js jitters every shape randomly unless pinned with a seed. Deriving
// the seed from the shape's own JSON means every client sketches the SAME
// wobble for the SAME shape — no wire-format change needed.
function seedFor(shape: Shape) {
  const json = JSON.stringify(shape);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// 📏 Distance from a point to a segment — the hit-test ruler for arrows and
// freehand strokes (returns `pad` so a click NEAR the ink still counts)
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

// 🎯 Did this click land on the shape? `pad` is in world units (~8 screen px)
function hitTest(shape: Shape, p: { x: number; y: number }, pad: number) {
  // 📝 A note is a solid object — anywhere inside its paper counts
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

// ✋ Move a shape by (dx, dy) — every kind stores its own coordinates, so each
// branch shifts exactly the fields that place it in the world
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

// ⬛ The selection marquee needs a bounding box for every shape kind
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

// ⚙️ Everything about the drawing surface lives here; React only wires it to
// the DOM and the socket. Returns the handles React needs: cleanup, remote
// shapes, and the zoom controls.
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
  // ✋ In-flight drag: the original shape stays untouched (its JSON is the
  // erase target), while `current` is the translated copy living on the board
  let moving: { orig: Shape; origJson: string; current: Shape } | null = null;
  // 📝 Note open for editing: live auto-sizing mutates the card, so we keep the
  // pristine copy + JSON — the JSON is the only erase key content addressing has
  let editingNote: { note: NoteShape; orig: NoteShape; origJson: string } | null = null;

  const camera: Camera = { offsetX: 80, offsetY: 80, zoom: 1 };
  const gen = rough.generator();

  // 🎨 Theming: colors live in globals.css (.theme-light/.theme-dark) as custom
  // properties, so the engine never hard-codes a palette. Cached between reads
  // because redraw runs every frame of a drag; React calls refreshTheme() when
  // the user flips the switch.
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
  readPalette(); // 🎬 first paint already matches the active theme class
  onCamera?.(camera); // 📢 React starts with the engine's true camera, not a guess

  function dpr() {
    return window.devicePixelRatio || 1;
  }

  // 🧹 Full repaint: every committed shape + the in-progress draft. The camera
  // transform turns world coordinates into device pixels in one setTransform.
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
    // 📏 2/zoom keeps the stroke thickness constant on screen at any zoom.
    // roughness 1 + bowing 0 is Excalidraw's recipe: one confident wobbly line
    // instead of scratchy doubled strokes (higher roughness makes Rough.js
    // overshoot and retrace long straight segments)
    const base = { stroke: palette.ink, strokeWidth: 2 / camera.zoom, roughness: 1, bowing: 0 };
    // ✒️ "solid" style = Rough.js roughness 0: the same pipeline, just perfectly
    // straight — which is exactly how Excalidraw's architect style works
    const styleFor = (shape: Shape) => ({
      ...base,
      seed: seedFor(shape),
      // "style" in shape narrows away the text variant, which has no style field
      roughness: "style" in shape && shape.style === "solid" ? 0 : 1,
    });

    for (const shape of existingShapes) {
      // 📝 Sticky note: solid paper square with a soft shadow, wrapped text
      // clipped inside. Not Rough.js — a note is an object, not ink
      if (shape.type === "note") {
        // 🎨 Yellow follows the theme palette; violet/green are fixed paper
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
        // ✂️ Keep lettering inside the paper no matter how much was typed
        ctx.beginPath();
        ctx.roundRect(shape.x, shape.y, shape.width, shape.height, 6);
        ctx.clip();
        // 🙈 While the textarea overlay is open IT is the lettering — painting
        // the stored text underneath would double it, and leave a ghost behind
        // once the box is cleared (shape.text only changes on commit)
        if (!(editingNote && editingNote.note === shape)) {
          ctx.fillStyle = tone?.ink ?? palette.noteInk;
          ctx.font = `600 ${NOTE_TEXT_SIZE}px Caveat, cursive`;
          ctx.textBaseline = "alphabetic";
          // 🧵 Measured wrap: the card was sized around these lines on commit
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
      // 🔤 Text skips Rough entirely — the Caveat hand font IS the aesthetic
      if (shape.type === "text") {
        ctx.save();
        ctx.fillStyle = palette.ink;
        ctx.font = `600 ${TEXT_SIZE}px Caveat, cursive`;
        ctx.textBaseline = "alphabetic";
        // ⇧⏎ lines stack at the same line height the DOM overlay uses
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

    // 🎯 Dashed marquee around the selected shape (lineWidth in world units so
    // the dash stays ~constant on screen at any zoom)
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

  // ✏️ Turn a Shape into Rough drawables — the hand-drawn version of strokeShape
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
      // 💠 Four corners of the bounding box, mid-edge — a rotated square look
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
      // 📏 Plain straight segment — no arrowhead, just the ruler line
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
    if (shape.type === "text") return []; // drawn with fillText in redraw
    if (shape.type === "note") return []; // drawn as a filled card in redraw
    if (shape.type === "arrow") {
      // ➤ Shaft plus a V-shaped head fanned back from the tip (150°) — one
      // continuous polyline so the seed jitter connects head to shaft
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

  // 🖥️ Pointer position in SCREEN pixels (relative to the canvas element)
  function toScreen(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // 📐 Screen -> world: undo the camera. All shapes live in world space.
  function toWorld(e: MouseEvent) {
    const s = toScreen(e);
    return {
      x: (s.x - camera.offsetX) / camera.zoom,
      y: (s.y - camera.offsetY) / camera.zoom,
    };
  }

  // 📝 Where the note's text caret should sit on screen: the paper's top-left
  // corner, inset by the text padding — the inset scales with the camera too
  function noteScreen(note: NoteShape) {
    return {
      x: note.x * camera.zoom + camera.offsetX + NOTE_PAD * camera.zoom,
      y: note.y * camera.zoom + camera.offsetY + NOTE_PAD * camera.zoom,
    };
  }

  // 📐 The paper size a note needs for its words: wrap at the max width, then
  // hug the widest line. Used on create, on every keystroke, and on commit.
  function noteSize(text: string) {
    ctx.save();
    ctx.font = `600 ${NOTE_TEXT_SIZE}px Caveat, cursive`;
    const measure = (s: string) => ctx.measureText(s).width;
    const lines = wrapNote(text, NOTE_MAX_W - NOTE_PAD * 2, measure);
    const widest = Math.max(...lines.map(measure));
    ctx.restore();
    return {
      // 📏 Round UP: rounding down by a fraction makes the repaint wrap the
      // widest line one word early, and the clipped word would disappear
      width: Math.ceil(
        Math.min(NOTE_MAX_W, Math.max(NOTE_MIN_W, widest + NOTE_PAD * 2 + 1)),
      ),
      height: Math.ceil(lines.length * NOTE_LINE_H + NOTE_PAD * 2 + 6),
    };
  }

  // 🔍 Zoom by `factor`, keeping the world point under the cursor stationary
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

  // 🖱️ Wheel: scroll pans, ctrl/cmd+wheel zooms (anchored at the cursor).
  // Native listener with passive:false — React's onWheel can't preventDefault.
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, toScreen(e));
    } else {
      camera.offsetX -= e.deltaX;
      camera.offsetY -= e.deltaY;
      redraw();
      onCamera?.(camera); // 📢 remote cursors ride the same camera as the shapes
    }
  }

  // 🎯 Swap the selection and tell React whether the delete button should show
  function setSelected(shape: Shape | null) {
    selected = shape;
    onSelection?.(shape !== null);
    redraw();
  }

  function onDown(e: MouseEvent) {
    // ✋ Middle button always pans the desk
    if (e.button === 1) {
      panning = true;
      const s = toScreen(e);
      panStart = { sx: s.x, sy: s.y, ox: camera.offsetX, oy: camera.offsetY };
      e.preventDefault();
      return;
    }
    // 📝 Note tool: one click drops a sticky note centred on the pointer and
    // hands React the caret spot — the note only reaches the server once it
    // has words (an untouched note is cancelled, not persisted)
    if (getTool() === "note" && e.button === 0) {
      e.preventDefault();
      const p = toWorld(e);
      // 📐 Start at the empty-note size; it grows with every keystroke
      const size = noteSize("");
      editingNote = null;
      const note: NoteShape = {
        type: "note",
        x: p.x - size.width / 2,
        y: p.y - size.height / 2,
        width: size.width,
        height: size.height,
        text: "",
        color: getNoteColor(), // 🎨 the swatch that was active at placement time
      };
      existingShapes.push(note);
      redraw();
      onNoteRequest?.(note, noteScreen(note), true);
      return;
    }
    // 🎯 Select + left button: pressing ON a shape grabs it for dragging;
    // pressing empty desk pans (and a non-drag press there clears the selection)
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
    // 🔤 Text tool: a click PLACES the caret — React hosts the input overlay
    // at that spot and calls commitText when the words are in. preventDefault
    // is REQUIRED: without it the browser's default mousedown focus-shift
    // fires after the overlay mounts and blurs it instantly (committing "")
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
    // ✋ Finish a shape drag. A real move is committed as erase-old + draw-new
    // (content addressing has no IDs); a sub-2px nudge is undone so a click
    // that wobbles never rewrites the row
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
      // 🎯 Select tool + barely-moved left press on empty desk = a CLICK:
      // clear the marquee (shapes were already grabbed on mousedown)
      const s = toScreen(e);
      const moved = Math.hypot(s.x - panStart.sx, s.y - panStart.sy);
      if (getTool() === "select" && e.button === 0 && moved < 4) {
        setSelected(null);
      }
      return;
    }
    if (!clicked) return; // mouseup without a press on this canvas (drag in from outside)
    clicked = false;
    const tool = getTool();
    const p = toWorld(e);

    // 🔒 Commit one shape from the drag, normalized so width/height stay positive
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
          style: getLineStyle(), // ✒️ stamp the toggle's current state onto the shape
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

    // ⚡ Local echo is already on screen; the server persists this shape and
    // relays it to everyone else in the room (ws-backend "draw" handler).
    emit(JSON.stringify(shape));
  }

  function onMove(e: MouseEvent) {
    onCursorMove?.(toWorld(e)); // 🖱️ presence first: hover, drag, pan — all count
    if (moving) {
      // 🧹 If the shape vanished remotely mid-drag, stop moving a ghost
      const idx = existingShapes.indexOf(moving.current);
      if (idx < 0) {
        moving = null;
        selected = null;
        onSelection?.(false);
        redraw();
        return;
      }
      // 📍 Always translate the ORIGINAL by the total delta — no drift from
      // accumulating per-move offsets
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

    // ✏️ Refresh the in-progress draft (nothing committed yet)
    if (tool === "rect" || tool === "ellipse" || tool === "diamond") {
      draftShape = {
        type: tool,
        x: Math.min(startX, p.x),
        y: Math.min(startY, p.y),
        width: Math.abs(p.x - startX),
        height: Math.abs(p.y - startY),
        style: getLineStyle(), // ✒️ preview matches what will be committed
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

  // 📝 Select-tool double-click: on a note it reopens the note's overlay,
  // anywhere else (blank paper or any shape) it plants a fresh text box
  function onDoubleClick(e: MouseEvent) {
    if (getTool() !== "select") return;
    const p = toWorld(e);
    const pad = 8 / camera.zoom;
    for (let i = existingShapes.length - 1; i >= 0; i--) {
      const shape = existingShapes[i];
      if (shape.type === "note" && hitTest(shape, p, pad)) {
        // 🧷 Remember the pristine card: live auto-sizing mutates it, but the
        // erase packet must carry the JSON the server actually stored
        editingNote = { note: shape, orig: { ...shape }, origJson: JSON.stringify(shape) };
        // 🫥 Repaint now so the stored lettering disappears the moment the
        // overlay takes over (otherwise the next keystroke is what hides it)
        redraw();
        onNoteRequest?.(shape, noteScreen(shape), false);
        return;
      }
    }
    // ✍️ No note under the cursor → plant free text right here, reusing the
    // exact overlay + commit path the text tool's single click already uses
    onTextRequest?.(p, toScreen(e));
  }

  // 📐 The canvas element is stretchy (absolute inset-0), so its BACKING STORE
  // must follow its CSS size × devicePixelRatio or strokes blur on hidpi screens.
  // ResizeObserver watches that for us; the camera transform does the rest.
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
  // 🖱️ passive:false so we can preventDefault — the page must never scroll-zoom
  // out from under the board (React's onWheel can't do this)
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // 📜 Hydrate the board from Postgres. Fail-soft: a dead backend or an
  // unauthenticated visitor still gets a drawable (empty) board.
  getExistingShapes(roomId)
    .then((shapes) => {
      existingShapes = shapes;
      redraw();
    })
    .catch(() => {
      console.warn("⚠️ Shape history unavailable — starting with an empty board");
    });

  return {
    // 🛰️ Called by the React layer when a "draw" packet arrives from a roommate
    addRemoteShape(shape: Shape) {
      existingShapes.push(shape);
      redraw();
    },
    // 🧹 Called when an "erase" packet arrives — drop the most recent matching
    // instance (mirrors the server's delete) and clear the marquee if it was ours
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
    // 🗑️ Delete key / trash button -> remove locally, notify React, tell the room.
    // Local removal happens immediately; the server deletes the row and relays
    // the erase to everyone else.
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
    // 📝 Called on every keystroke while a note overlay is open: the paper hugs
    // the current words, so the card grows/shrinks live instead of clipping
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
    // ↩️ Escape while editing: put the original paper size back (nothing was sent)
    cancelNoteEdit(note: NoteShape) {
      if (!editingNote || editingNote.note !== note) return;
      note.width = editingNote.orig.width;
      note.height = editingNote.orig.height;
      editingNote = null;
      redraw();
    },
    // 📝 The React overlay finished with a note. New note + empty text = the
    // user changed their mind: drop it locally, send nothing. New note with
    // words = a plain draw. Edited note = erase + draw, same as a move (the
    // OLD JSON is the only key content addressing has). Clearing a saved note
    // deletes it — blank paper never persists.
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
    // 🔤 The React text overlay finished collecting words — commit the shape
    // at the world spot the user originally clicked, then broadcast it
    commitText(x: number, y: number, text: string) {
      const clean = text.trim();
      if (!clean) return;
      const shape: Shape = { type: "text", x, y, text: clean };
      existingShapes.push(shape);
      redraw();
      emit(JSON.stringify(shape));
    },
    // 🎨 The room flipped light/dark: re-read the CSS palette and repaint.
    // Shapes carry no theme data — only the ink color changes.
    refreshTheme() {
      readPalette();
      redraw();
    },
    // 🔍 Buttons mirror ctrl/cmd+wheel: zoom around the view center
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

// 🎛️ The shape of the object initDraw hands back — React types its ref with this
export type EngineHandle = ReturnType<typeof initDraw>;

// 🗄️ GET /shapes/:roomId — auth cookie required, returns the last 200 shapes
async function getExistingShapes(roomId: number): Promise<Shape[]> {
  const res = await axios.get(`${BACKEND_URL}/shapes/${roomId}`, {
    withCredentials: true,
  });
  return res.data.shapes.map((row: { shape: string }) => JSON.parse(row.shape));
}
