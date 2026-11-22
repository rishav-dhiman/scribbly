"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HomeIcon, LinkIcon, WallIcon } from "../ui/icons";

// ☰ The top-left hamburger menu — board name, copy link, and the ways out.
export function MenuButton({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // 🚪 Close on every return. Next 16 parks visited rooms in a hidden Activity:
  // leaving disconnects effects, returning reconnects them AND restores state —
  // so an open menu would survive the round-trip. First run is the real mount,
  // later runs are re-entries.
  const firstConnect = useRef(true);
  useEffect(() => {
    if (firstConnect.current) {
      firstConnect.current = false;
      return;
    }
    setOpen(false);
  }, []);

  // 🔗 Grab the board's URL; the "copied!" feedback resets after a beat
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Board menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all active:translate-y-0 active:shadow-[1px_1px_0_0_rgba(38,35,79,0.6)] ${
          open
            ? "border-[#26234f]/50 bg-[#6965db]/15 text-[#5b57c9] shadow-[2px_2px_0_0_rgba(38,35,79,0.6)] dark:border-[#8b87f5]/50 dark:bg-[#6965db]/25 dark:text-[#b9b5ff] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.8)]"
            : "border-[#26234f]/25 bg-[#fffdf6] text-[#26234f]/70 shadow-[2px_2px_0_0_rgba(38,35,79,0.6)] hover:-translate-y-0.5 hover:text-[#26234f] hover:shadow-[3px_3px_0_0_rgba(38,35,79,0.6)] dark:border-white/15 dark:bg-[#101013] dark:text-zinc-400 dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.8)] dark:hover:text-zinc-100"
        }`}
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
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* 🙈 Invisible overlay closes the menu on any outside click */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      {open && (
        <div className="absolute left-0 top-12 z-20 w-56 -rotate-1 rounded-lg border-2 border-[#26234f]/25 bg-[#f6f1e4] shadow-[4px_4px_0_0_rgba(38,35,79,0.85)] dark:border-white/15 dark:bg-[#101013] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.9)]">
          {/* 🩹 washi tape holding the menu up */}
          <span
            aria-hidden="true"
            className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 -rotate-3 bg-[#f3e3a3]/90 shadow-sm"
          />
          <p className="border-b-2 border-dashed border-[#26234f]/15 px-4 pt-3 pb-2 font-hand text-xl font-semibold text-[#26234f] dark:border-white/10 dark:text-zinc-100">
            room-no-{roomId}
          </p>

          <div className="py-1.5">
            <button
              type="button"
              onClick={copyLink}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-[#26234f]/85 transition-all hover:translate-x-0.5 hover:bg-[#6965db]/10 hover:text-[#26234f] dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <LinkIcon className="h-3.5 w-3.5 shrink-0" />
              {copied ? "copied!" : "Copy board link"}
            </button>
            <Link
              href="/rooms"
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium text-[#26234f]/85 transition-all hover:translate-x-0.5 hover:bg-[#6965db]/10 hover:text-[#26234f] dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <WallIcon className="h-3.5 w-3.5 shrink-0" />
              Back to the wall
            </Link>
          </div>
          <Link
            href="/"
            className="flex w-full items-center gap-2.5 border-t-2 border-dashed border-[#26234f]/15 px-4 py-2.5 text-sm font-medium text-[#26234f]/60 transition-all hover:translate-x-0.5 hover:bg-[#6965db]/10 hover:text-[#26234f] dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <HomeIcon className="h-3.5 w-3.5 shrink-0" />
            Landing page
          </Link>
        </div>
      )}
    </div>
  );
}
