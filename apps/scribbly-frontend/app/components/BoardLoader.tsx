"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { BACKEND_URL } from "@/app/config";
import { RoomCanvas } from "@/app/components/RoomCanvas";
import { StickyNote } from "@/app/components/ui/StickyNote";

// Resolves /board/[slug] -> room id, then hands off to the canvas. Also the
// auth gate: expired sessions go to /signin, unknown slugs get a paper 404.
type Status = "loading" | "ready" | "missing";

export function BoardLoader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [roomId, setRoomId] = useState<number | null>(null);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/rooms/${slug}`, { withCredentials: true })
      .then((res) => {
        setRoomId(res.data.room.id);
        setStatus("ready");
      })
      .catch((err) => {
        const code = err.response?.status;
        if (code === 401 || code === 403) {
          router.replace("/signin"); // stale or missing session
          return;
        }
        setStatus("missing");
      });
  }, [slug, router]);

  if (status === "ready" && roomId !== null) {
    return <RoomCanvas roomId={String(roomId)} slug={slug} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f1e4] p-6 [color-scheme:light]">
      {status === "loading" ? (
        <p className="font-hand text-2xl font-semibold text-[#26234f]/60">
          unrolling the paper…
        </p>
      ) : (
        <StickyNote rotate={-1.5}>
          <p className="font-hand text-2xl font-semibold text-[#3f3310]">
            no board pinned under “{slug}”
          </p>
          <p className="mt-1 text-sm text-[#3f3310]/80">
            check the spelling, or pin a new one from the wall.
          </p>
          <Link
            href="/rooms"
            className="mt-3 inline-block rounded-lg border border-[#3f3310]/30 px-3 py-1.5 text-sm font-semibold text-[#3f3310] transition-colors hover:bg-[#3f3310]/10"
          >
            ← back to the wall
          </Link>
        </StickyNote>
      )}
    </div>
  );
}
