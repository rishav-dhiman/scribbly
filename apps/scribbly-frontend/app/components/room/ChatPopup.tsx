"use client";

import { useEffect, useRef } from "react";

// The room chat as a floating popup note: a paper card that springs out
// of the chat sticker in the corner. Purely presentational; Canvas owns the
// socket, the history fetch, and the open/close state.
export interface ChatMessage {
  message: string;
  userId: string;
  userName?: string;
}

export function ChatPopup({
  chats,
  myUserId,
  currentMessage,
  onMessageChange,
  onSend,
  canSend,
  onClose,
}: {
  chats: ChatMessage[];
  myUserId: string;
  currentMessage: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  onClose: () => void;
}) {
  // The thread always sits at the newest note, for live sends AND history loads
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chats.length, chats]);

  return (
    <aside className="flex h-[26rem] max-h-[70vh] w-80 flex-col overflow-hidden rounded-2xl border-2 border-[#26234f]/20 bg-[#fffdf6] shadow-[5px_6px_0_0_rgba(38,35,79,0.8)] dark:border-white/15 dark:bg-[#101013] dark:shadow-[5px_6px_0_0_rgba(0,0,0,0.9)]">
      <header className="flex shrink-0 items-center justify-between border-b-2 border-dashed border-[#26234f]/15 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="font-hand text-xl font-semibold text-[#26234f] dark:text-zinc-100">
            room notes
          </span>
          {/* Green LIVE badge: same "connection is live" language as the presence dot */}
          <span className="flex items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close chat"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#26234f]/50 transition-all hover:bg-[#26234f]/5 hover:text-[#26234f] active:scale-90 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <main
        ref={threadRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {chats.map((m, i) => {
          // History carries real ids; the optimistic "me" sentinel matches too
          const isMe = m.userId === myUserId || m.userId === "me";
          return (
            <div
              key={i}
              className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[85%] flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {!isMe && (
                  <span className="mb-0.5 ml-1 font-hand text-sm text-[#26234f]/50 dark:text-zinc-500">
                    {m.userName ?? `@${m.userId.slice(0, 6)}`}
                  </span>
                )}
                <p
                  className={`whitespace-pre-wrap wrap-break-word rounded-xl border px-3 py-1.5 text-sm shadow-[2px_2px_0_0_rgba(38,35,79,0.12)] ${
                    isMe
                      ? "border-[#5b57c9] bg-[#6965db] font-medium text-white"
                      : "border-[#26234f]/15 bg-white text-[#26234f] dark:border-white/10 dark:bg-[#18181b] dark:text-zinc-200"
                  }`}
                >
                  {m.message}
                </p>
              </div>
            </div>
          );
        })}
      </main>

      <footer className="shrink-0 border-t-2 border-dashed border-[#26234f]/15 p-2.5 dark:border-white/10">
        <div className="flex items-center gap-1.5 rounded-xl border border-[#26234f]/15 bg-white p-1 transition-colors focus-within:border-[#6965db] dark:border-white/15 dark:bg-[#18181b]">
          <input
            value={currentMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            type="text"
            placeholder="Leave a note for the room"
            className="w-full bg-transparent px-2.5 py-1.5 text-sm text-[#26234f] outline-none placeholder:text-[#26234f]/40 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            onClick={onSend}
            disabled={!canSend || !currentMessage.trim()}
            className="shrink-0 rounded-lg bg-[#6965db] px-3 py-1.5 text-xs font-semibold text-white shadow-[2px_2px_0_0_#26234f] transition-all hover:bg-[#5b57c9] active:translate-y-px active:shadow-none disabled:bg-[#26234f]/10 disabled:text-[#26234f]/30 disabled:shadow-none dark:shadow-[2px_2px_0_0_#000] dark:disabled:bg-white/10 dark:disabled:text-zinc-500"
          >
            Send
          </button>
        </div>
      </footer>
    </aside>
  );
}
