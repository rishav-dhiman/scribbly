"use client";

import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { WsPresence } from "@repo/zod-config";
import { BACKEND_URL } from "@/app/config";
import { useSocket } from "../hooks/useSocket";
import {
  initDraw,
  NOTE_PAD,
  NOTE_TEXT_SIZE,
  type EngineHandle,
  type LineStyle,
  type NoteColor,
  type NoteShape,
  type Tool,
} from "./draw";
import { ChatPopup, type ChatMessage } from "./room/ChatPopup";
import { MenuButton } from "./room/MenuButton";
import { PresencePill, avatarColor } from "./room/PresencePill";
import { SHORTCUTS, ToolBar } from "./room/ToolBar";
import { ZoomControls } from "./room/ZoomControls";
import { ArrowDoodle } from "./ui/Doodles";

// The overlay's ink must match what the canvas paints on that paper.
function noteInk(color: NoteColor | undefined, theme: "light" | "dark") {
  if (color === "violet") return "#26234f";
  if (color === "green") return "#1f3a24";
  return theme === "dark" ? "#3f3310" : "#26234f";
}

export function Canvas({ roomId, slug }: { roomId: string; slug?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socket = useSocket();

  // Next 16 parks visited rooms in a hidden Activity: returning restores
  // component state, so the first effect run is the real mount and every later
  // run means "we came back" — reset the ephemeral UI then.
  const firstConnect = useRef(true);
  useEffect(() => {
    if (firstConnect.current) {
      firstConnect.current = false;
      return;
    }
    setTool("select");
    setChatOpen(false);
    setCurrentMessage("");
    setTextDraft(null);
    setError("");
    setHasSelection(false);
  }, []);

  // The engine owns the camera; React mirrors it for the zoom label and cursors.
  const engineRef = useRef<EngineHandle | null>(null);
  const [camera, setCamera] = useState({ offsetX: 80, offsetY: 80, zoom: 1 });

  // Ref mirrors keep the engine initialised once: state drives styling, refs
  // give the engine the current value inside its listeners.
  const [tool, setTool] = useState<Tool>("select");
  const toolRef = useRef<Tool>("select");
  toolRef.current = tool;

  const [lineStyle, setLineStyle] = useState<LineStyle>("rough");
  const lineStyleRef = useRef<LineStyle>("rough");
  lineStyleRef.current = lineStyle;

  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const noteColorRef = useRef<NoteColor>("yellow");
  noteColorRef.current = noteColor;

  // Persisted preference, not room state.
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // SSR renders light; reading localStorage after mount avoids a hydration mismatch.
  useEffect(() => {
    if (localStorage.getItem("board-theme") === "dark") setTheme("dark");
  }, []);

  // The engine paints from CSS variables, so a theme flip is a palette re-read.
  useEffect(() => {
    localStorage.setItem("board-theme", theme);
    engineRef.current?.refreshTheme();
  }, [theme]);

  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [error, setError] = useState("");

  // Chat history carries ids, not the "me" sentinel, so my own messages stay
  // right-aligned after a refresh only if this is resolved.
  const [myUserId, setMyUserId] = useState("");

  const [members, setMembers] = useState<WsPresence["members"]>([]);

  // Remote pointers in world coordinates. `at` is the last packet time so a
  // pointer that stops sending fades out instead of freezing.
  const [cursors, setCursors] = useState<
    Record<string, { x: number; y: number; name: string; at: number }>
  >({});

  const [chatOpen, setChatOpen] = useState(false);

  const [hasSelection, setHasSelection] = useState(false);

  // The engine reports the click spot; React hosts the input overlay there.
  const [textDraft, setTextDraft] = useState<{
    wx: number;
    wy: number;
    sx: number;
    sy: number;
    value: string;
    // Set when typing inside a sticky note; `created` marks an unpersisted note.
    note?: NoteShape;
    created?: boolean;
  } | null>(null);

  const draftRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = draftRef.current;
    if (!el || textDraft?.note) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [textDraft]);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/me`, { withCredentials: true })
      .then((res) => setMyUserId(String(res.data.user?.id ?? "")))
      .catch(() => setMyUserId(""));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const next = SHORTCUTS[e.key.toLowerCase()];
      if (next) setTool(next);
      if (e.key === "Delete" || e.key === "Backspace") {
        engineRef.current?.deleteSelected();
      }
      if (e.key === "Escape") {
        setTool("select");
        setChatOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/chats/${roomId}`, { withCredentials: true })
      .then((res) => setChats(res.data.messages))
      .catch(() => {
        console.warn("Chat history unavailable — live messages still work");
      });
  }, [roomId]);

  // A mouse leaving the canvas sends no "goodbye", so silence is the signal:
  // pointers that stop updating fade out on their own.
  useEffect(() => {
    const id = setInterval(() => {
      setCursors((current) => {
        const now = Date.now();
        const next: typeof current = {};
        let dropped = false;
        for (const [userId, cursor] of Object.entries(current)) {
          if (now - cursor.at < 4000) next[userId] = cursor;
          else dropped = true;
        }
        return dropped ? next : current;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // React owns the socket; the engine only draws and reports committed shapes.
  useEffect(() => {
    if (!socket) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // The server confirms membership with a "status" packet only after its DB
    // check resolves, and drawing before that is rejected. Shapes committed
    // early wait in this queue and flush when the join confirms.
    let joined = false;
    const pendingShapes: string[] = [];

    setMembers([]);
    setCursors({});
    socket.send(JSON.stringify({ type: "join_room", roomId }));

    // ~25 pointer packets/second per user, rounded to whole world units.
    let lastCursorAt = 0;
    const sendCursor = (world: { x: number; y: number }) => {
      const now = performance.now();
      if (!joined || now - lastCursorAt < 40) return;
      if (socket.readyState !== WebSocket.OPEN) return;
      lastCursorAt = now;
      socket.send(
        JSON.stringify({
          type: "cursor",
          roomId: Number(roomId),
          x: Math.round(world.x),
          y: Math.round(world.y),
        }),
      );
    };

    const emit = (shapeJson: string) => {
      if (joined && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "draw", roomId: Number(roomId), message: shapeJson }),
        );
      } else {
        pendingShapes.push(shapeJson);
      }
    };

    const emitErase = (shapeJson: string) => {
      if (joined && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ type: "erase", roomId: Number(roomId), message: shapeJson }),
        );
      }
    };

    const engine = initDraw(canvas, ctx, {
      roomId: Number(roomId),
      getTool: () => toolRef.current,
      getLineStyle: () => lineStyleRef.current,
      getNoteColor: () => noteColorRef.current,
      emit,
      emitErase,
      onCamera: (next) => setCamera({ ...next }), // copy: React bails out on same-reference state
      onCursorMove: sendCursor,
      onSelection: setHasSelection,
      onTextRequest: (world, screen) =>
        setTextDraft({
          wx: world.x,
          wy: world.y,
          sx: screen.x,
          sy: screen.y,
          value: "",
        }),
      onNoteRequest: (note, screen, created) =>
        setTextDraft({
          wx: note.x,
          wy: note.y,
          sx: screen.x,
          sy: screen.y,
          value: note.text,
          note,
          created,
        }),
    });
    engineRef.current = engine;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "status" && data.status === "success") {
        joined = true;
        while (pendingShapes.length && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "draw",
              roomId: Number(roomId),
              message: pendingShapes.shift(),
            }),
          );
        }
        return;
      }

      if (data.type === "error") {
        setError(String(data.message));
        return;
      }

      // The packet IS the full roster: replace, never merge.
      if (data.type === "presence") {
        setMembers(data.members);
        const present = new Set<string>(
          data.members.map((m: { userId: string }) => m.userId),
        );
        setCursors((current) => {
          const next: typeof current = {};
          for (const [userId, cursor] of Object.entries(current)) {
            if (present.has(userId)) next[userId] = cursor;
          }
          return next;
        });
        return;
      }

      // Stored in world coordinates; projection happens at render time.
      if (data.type === "cursor") {
        setCursors((current) => ({
          ...current,
          [data.userId]: {
            x: data.x,
            y: data.y,
            name: data.userName,
            at: Date.now(),
          },
        }));
        return;
      }

      if (data.type === "draw") {
        // The wire format is exactly the engine's Shape JSON.
        engine.addRemoteShape(JSON.parse(data.message));
      }

      if (data.type === "erase") {
        engine.removeRemoteShape(data.message);
      }

      if (data.type === "chat") {
        setError("");
        setChats((c) => [
          ...c,
          { message: data.message, userId: data.userId, userName: data.userName },
        ]);
      }
    };

    return () => {
      engineRef.current = null;
      engine.cleanup();
      socket.onmessage = null;
    };
  }, [socket, roomId]);

  function commitTextDraft() {
    if (!textDraft) return;
    const { wx, wy, value, note, created } = textDraft;
    setTextDraft(null);
    if (note) {
      // An unchanged edit sends nothing. The engine stops painting the note's
      // text while editing, so hand it back or an unchanged note stays blank.
      if (!created && value.trim() === note.text) {
        engineRef.current?.cancelNoteEdit(note);
        return;
      }
      engineRef.current?.commitNote(note, value, created ?? false);
      return;
    }
    engineRef.current?.commitText(wx, wy, value);
  }

  function updateDraft(value: string) {
    if (!textDraft) return;
    setTextDraft({ ...textDraft, value });
    if (textDraft.note) engineRef.current?.fitNote(textDraft.note, value);
  }

  function sendMessage() {
    if (!currentMessage.trim() || !socket) return;

    socket.send(
      JSON.stringify({
        type: "chat",
        roomId: Number(roomId),
        message: currentMessage.trim(),
      }),
    );

    // Optimistic append: the server never echoes a chat back to its sender.
    setChats((c) => [
      ...c,
      { message: currentMessage.trim(), userId: myUserId || "me" },
    ]);
    setCurrentMessage("");
  }

  return (
    <div
      className={`flex h-screen w-full flex-col bg-[#f6f1e4] text-[#26234f] dark:bg-[#0c0c0e] dark:text-zinc-200 ${
        theme === "dark" ? "theme-dark" : "theme-light"
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <MenuButton roomId={roomId} />
          <span className="hidden font-hand text-xl font-semibold text-[#26234f]/70 sm:inline dark:text-zinc-400">
            {slug ?? "untitled board"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {hasSelection && (
            <button
              type="button"
              onClick={() => engineRef.current?.deleteSelected()}
              title="Delete selected (Del)"
              className="flex h-9 items-center gap-1.5 rounded-lg border-2 border-red-300 bg-red-50 px-3 text-xs font-semibold text-red-600 shadow-[2px_2px_0_0_rgba(38,35,79,0.6)] transition-all hover:-translate-y-0.5 hover:bg-red-100 active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(38,35,79,0.6)] dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-300 dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.7)] dark:hover:bg-red-500/25"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h8l1-13" />
              </svg>
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#26234f]/25 bg-[#fffdf6] text-[#26234f]/70 shadow-[2px_2px_0_0_rgba(38,35,79,0.6)] transition-all hover:-translate-y-0.5 hover:text-[#26234f] active:translate-y-0 dark:border-white/15 dark:bg-[#101013] dark:text-zinc-400 dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.8)] dark:hover:text-zinc-100"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {theme === "dark" ? (
                // Solid crescent: an outline this thin reads as "(" at 16px.
                <path
                  d="M9.94 3.24A9 9 0 1 0 20.76 14.06A8 8 0 0 1 9.94 3.24Z"
                  fill="currentColor"
                  stroke="none"
                />
              ) : (
                <>
                  <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
                  <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
                </>
              )}
            </svg>
          </button>
          <PresencePill members={members} />
        </div>
      </header>

      {/* overflow-hidden: the engine pans and zooms an infinite world inside */}
      <div className="relative flex-1 overflow-hidden">
        {error && (
          <p className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(38,35,79,0.08)_1px,transparent_1px)] bg-size-[20px_20px] dark:bg-[radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)]" />

        <ToolBar
          tool={tool}
          onSelect={setTool}
          lineStyle={lineStyle}
          onLineStyle={setLineStyle}
          noteColor={noteColor}
          onNoteColor={setNoteColor}
        />

        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center">
          <p className="font-hand text-2xl font-semibold text-[#26234f]/60 dark:text-zinc-500">
            pick a tool &amp; start drawing!
          </p>
          <ArrowDoodle ink className="mt-1 w-10 rotate-180 text-[#6965db]/70 dark:text-[#b9b5ff]/60" />
        </div>

        <canvas
          ref={canvasRef}
          className={`absolute inset-0 block h-full w-full touch-none ${
            tool === "select" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"
          }`}
        />

        {textDraft && (
          <textarea
            ref={draftRef}
            autoFocus
            rows={1}
            value={textDraft.value}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitTextDraft();
              }
              if (e.key === "Escape") {
                // Escape cancels a new note locally; an existing note gets its
                // original paper size back.
                if (textDraft.note) {
                  if (textDraft.created) {
                    engineRef.current?.commitNote(textDraft.note, "", true);
                  } else {
                    engineRef.current?.cancelNoteEdit(textDraft.note);
                  }
                }
                setTextDraft(null);
                setTool("select");
              }
            }}
            onBlur={commitTextDraft}
            placeholder={textDraft.note ? undefined : "type something…"}
            className={
              textDraft.note
                ? "absolute z-30 resize-none overflow-hidden border-0 bg-transparent p-0 font-hand font-semibold outline-none"
                : "absolute z-30 min-h-10 w-64 resize-none rounded-md border-2 border-[#6965db]/50 bg-white/90 px-2 py-1 font-hand font-semibold text-[#26234f] shadow-[2px_2px_0_0_rgba(38,35,79,0.4)] outline-none dark:border-[#8b87f5]/60 dark:bg-[#18181b] dark:text-zinc-100"
            }
            style={
              textDraft.note
                ? {
                    left: textDraft.sx,
                    top: textDraft.sy,
                    width: (textDraft.note.width - NOTE_PAD * 2) * camera.zoom,
                    height: (textDraft.note.height - NOTE_PAD * 2) * camera.zoom,
                    fontSize: NOTE_TEXT_SIZE * camera.zoom,
                    lineHeight: 1.15,
                    color: noteInk(textDraft.note.color, theme),
                    caretColor: noteInk(textDraft.note.color, theme),
                  }
                : {
                    left: textDraft.sx,
                    top: textDraft.sy,
                    fontSize: 28,
                    lineHeight: 1.15,
                  }
            }
          />
        )}

        <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
          {Object.entries(cursors).map(([userId, cursor]) => (
            <div
              key={userId}
              className="absolute top-0 left-0 transition-transform duration-75 ease-linear will-change-transform"
              style={{
                transform: `translate(${cursor.x * camera.zoom + camera.offsetX}px, ${
                  cursor.y * camera.zoom + camera.offsetY
                }px)`,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
              >
                <path
                  d="M4 2.2 20.5 11l-7.2 1.9L8 20.4z"
                  fill={avatarColor(userId)}
                  stroke="#fffdf6"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="ml-3 inline-block rounded-full px-2 py-0.5 font-hand text-xs font-semibold whitespace-nowrap text-white shadow-[1px_2px_0_0_rgba(38,35,79,0.35)]"
                style={{ backgroundColor: avatarColor(userId) }}
              >
                {cursor.name}
              </span>
            </div>
          ))}
        </div>

        <ZoomControls
          zoom={camera.zoom}
          onZoomIn={() => engineRef.current?.zoomIn()}
          onZoomOut={() => engineRef.current?.zoomOut()}
          onReset={() => engineRef.current?.resetZoom()}
        />

        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          aria-pressed={chatOpen}
          title={chatOpen ? "Close room notes" : "Open room notes"}
          className={`absolute right-5 bottom-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all active:translate-y-0 active:shadow-[2px_2px_0_0_#26234f] ${
            chatOpen
              ? "border-[#26234f]/50 bg-[#5b57c9] text-white shadow-[2px_2px_0_0_#26234f]"
              : "border-[#26234f]/30 bg-[#6965db] text-white shadow-[3px_3px_0_0_#26234f] hover:-translate-y-0.5 hover:bg-[#5b57c9] hover:shadow-[4px_4px_0_0_#26234f]"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a8 8 0 0 1-8 8H4l2-3.5A8 8 0 1 1 21 12z" />
          </svg>
        </button>

        <AnimatePresence>
          {chatOpen && (
            <motion.div
              key="chat-popup"
              className="absolute right-5 bottom-20 z-30"
              initial={{ opacity: 0, scale: 0.4, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.4, y: 24 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              style={{ transformOrigin: "bottom right" }}
            >
              <ChatPopup
                chats={chats}
                myUserId={myUserId}
                currentMessage={currentMessage}
                onMessageChange={setCurrentMessage}
                onSend={sendMessage}
                canSend={!!socket}
                onClose={() => setChatOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
