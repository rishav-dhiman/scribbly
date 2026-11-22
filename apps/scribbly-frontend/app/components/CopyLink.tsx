"use client";

import { useState } from "react";

export function CopyLink() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/board/no-1`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`ml-auto rounded px-2 py-1 font-mono text-[10px] transition-colors ${
        copied
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-white/6 text-zinc-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {copied ? "copied!" : "copy link"}
    </button>
  );
}
