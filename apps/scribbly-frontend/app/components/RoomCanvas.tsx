"use client";

import { Canvas } from "./Canvas";

// Thin page-level wrapper: Canvas owns the socket (useSocket), the join,
// and the engine. `slug` is optional, so boards reached via /board/[slug] show it
// in the header while legacy redirects still mount without one.
export function RoomCanvas({ roomId, slug }: { roomId: string; slug?: string }) {
  return (
    <div className="min-h-screen bg-[#f6f1e4]">
      <Canvas roomId={roomId} slug={slug} />
    </div>
  );
}
