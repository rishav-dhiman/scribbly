"use client";

import axios from "axios";
import Link from "next/link";
import { useState } from "react";
import { BACKEND_URL } from "../../config";
import { Tape } from "../ui/PaperCard";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TrashIcon, XIcon } from "../ui/icons";

// One room pinned to the lobby wall as a tilted paper note.
export type WallRoom = {
  id: number;
  slug: string;
  createdAt: string;
  adminId: string;
  isOwner: boolean;
  _count: { shapes: number };
};

// Sticky-note tints cycle so the wall doesn't look photocopied
const TINTS = [
  { bg: "#f3e3a3", ink: "#3f3310" },
  { bg: "#e0ddf5", ink: "#26234f" },
  { bg: "#d6ead6", ink: "#1f3d2b" },
  { bg: "#f6d3d3", ink: "#4a1d1d" },
] as const;

function tintFor(index: number) {
  return TINTS[index % TINTS.length] ?? TINTS[0];
}

export function RoomNote({
  room,
  index,
  onRemoved,
}: {
  room: WallRoom;
  index: number;
  onRemoved: (id: number) => void;
}) {
  const tint = tintFor(index);
  // Neighboring notes lean a different way, like they were pinned by hand
  const tilt = ((index % 5) - 2) * 1.2;

  // The creator deletes the room for EVERYONE; a member only takes it off
  // their own wall. Both confirm first in the themed card, and owner delete can't be undone.
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmRemove() {
    setBusy(true);
    try {
      if (room.isOwner) {
        await axios.delete(`${BACKEND_URL}/rooms/${room.id}`, {
          withCredentials: true,
        });
      } else {
        await axios.post(
          `${BACKEND_URL}/rooms/${room.id}/leave`,
          {},
          { withCredentials: true },
        );
      }
      onRemoved(room.id);
    } catch {
      // The note stays, because nothing was deleted server-side
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="group relative block h-full">
      <div
        style={{ transform: `rotate(${tilt}deg)`, backgroundColor: tint.bg }}
        className="relative h-full border border-black/10 p-4 pt-7 shadow-[4px_6px_0_0_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-0"
      >
        <Tape rotate={tilt > 0 ? -4 : 3} />

        <p
          style={{ color: tint.ink }}
          className="font-hand text-2xl font-semibold leading-none"
        >
          {room.slug}
        </p>
        <p style={{ color: tint.ink }} className="mt-2 text-[11px] opacity-70">
          {room._count.shapes} doodle{room._count.shapes === 1 ? "" : "s"} ·
          pinned {new Date(room.createdAt).toLocaleDateString()}
        </p>

        {/* The "open" affordance only shows on hover, which keeps the wall clean */}
        <span
          style={{ color: tint.ink }}
          className="mt-3 inline-block font-hand text-sm underline underline-offset-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          open the board →
        </span>
      </div>

      {/* An invisible stretched link keeps the WHOLE note clickable */}
      <Link
        href={`/board/${room.slug}`}
        aria-label={`Open ${room.slug}`}
        className="absolute inset-0"
      />

      {/* The remove button sits above the link (z-index) so this click never opens the board */}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={room.isOwner ? "Delete room for everyone" : "Remove from your wall"}
        className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-black/15 bg-white/85 shadow-sm transition-all hover:bg-white active:scale-90"
        style={{ color: room.isOwner ? "#b91c1c" : tint.ink }}
      >
        {room.isOwner ? (
          <TrashIcon className="h-3.5 w-3.5" />
        ) : (
          <XIcon className="h-3.5 w-3.5" />
        )}
      </button>

      <ConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={confirmRemove}
        busy={busy}
        danger={room.isOwner}
        title={room.isOwner ? "tear it down?" : "unpin this one?"}
        message={
          room.isOwner
            ? `'${room.slug}' and everything on it will be gone for everyone. No undo.`
            : `'${room.slug}' comes off your wall, but stays up for everyone else.`
        }
        confirmLabel={room.isOwner ? "Delete it" : "Remove it"}
      />
    </div>
  );
}
