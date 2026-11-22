"use client";

import type { WsPresence } from "@repo/zod-config";

// Deterministic avatar color: same userId always lands on the same hue
export function avatarColor(userId: string) {
  let hue = 0;
  for (const ch of userId) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hue} 60% 55%)`;
}

// Who is holding a marker right now: avatars + count, top-right of the board
export function PresencePill({ members }: { members: WsPresence["members"] }) {
  return (
    <div
      title={members.map((m) => m.userName).join(", ") || "Just you"}
      className="flex items-center gap-2 rounded-full border border-[#26234f]/15 bg-[#fffdf6]/95 py-1 pl-2.5 pr-1.5 shadow-[0_8px_20px_-10px_rgba(38,35,79,0.4)] backdrop-blur dark:border-white/10 dark:bg-[#101013]/95 dark:shadow-[0_8px_20px_-10px_rgba(0,0,0,0.9)]"
    >
      <span className="flex items-center gap-1.5 font-hand text-sm font-semibold text-[#26234f]/80 dark:text-zinc-300">
        {/* green = the room connection is LIVE (violet reads as "brand", not "status") */}
        <span className="animate-pulse-soft h-2 w-2 rounded-full bg-emerald-500" />
        {members.length} online
      </span>
      <span className="flex -space-x-1.5">
        {members.slice(0, 3).map((m) => (
          <span
            key={m.userId}
            title={m.userName}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-[#fffdf6] dark:ring-[#101013]"
            style={{ backgroundColor: avatarColor(m.userId) }}
          >
            {m.userName.charAt(0).toUpperCase()}
          </span>
        ))}
        {members.length > 3 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#26234f]/15 text-[10px] font-semibold text-[#26234f] ring-2 ring-[#fffdf6] dark:ring-[#101013]">
            +{members.length - 3}
          </span>
        )}
      </span>
    </div>
  );
}
