"use client";

import axios from "axios";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "../config";
import { NewBoardNote } from "../components/lobby/NewBoardNote";
import { RoomNote, type WallRoom } from "../components/lobby/RoomNote";
import { SessionChip } from "../components/ui/SessionChip";
import { ArrowDoodle, UnderlineDoodle } from "../components/ui/Doodles";
import { DotField, Sparkle } from "../components/ui/Backdrop";

export default function RoomsPage() {
  const router = useRouter();

  // 👤 Session — fetched on mount; no/invalid cookie bounces to /signin
  const [userName, setUserName] = useState("");

  // 🧱 Boards pinned to the wall, newest first
  const [rooms, setRooms] = useState<WallRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // 🔐 Validate the real session (cookie + DB user), not just cookie presence
  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/me`, { withCredentials: true })
      .then((res) => setUserName(res.data.user?.name ?? res.data.name ?? "there"))
      .catch(() => router.push("/signin"));
  }, [router]);

  // 🧱 Load the wall. A broken list must not kick a signed-in user out,
  // so failures here only leave the wall empty.
  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/rooms`, { withCredentials: true })
      .then((res) => setRooms(res.data.rooms ?? []))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950">
      {/* · the board itself: dot field + a few hand-placed sparkles */}
      <DotField dotOpacity={0.08} />
      <Sparkle className="left-[8%] top-[14%] text-2xl text-[#8b87f5]/50">✦</Sparkle>
      <Sparkle className="right-[10%] top-[22%] text-xl text-[#f3e3a3]/40">✦</Sparkle>
      <Sparkle className="bottom-[12%] left-[16%] text-xl text-[#8b87f5]/40">✦</Sparkle>

      <div className="relative mx-auto max-w-5xl px-5 py-8">
        {/* 🧷 Header: the wall's title + who is holding the marker */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="font-hand text-base text-zinc-500 transition-colors hover:text-[#8b87f5]"
            >
              ← back to the landing
            </Link>
            <h1 className="relative mt-1 font-hand text-5xl font-semibold leading-none text-zinc-100">
              the wall
              <UnderlineDoodle
                ink
                className="absolute -bottom-2 left-0 w-40 text-[#8b87f5]"
              />
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Every board you have pinned, in one place.
            </p>
          </div>

          {/* 👤 Session chip + the way out */}
          <SessionChip name={userName} />
        </header>

        {/* 📌 The wall: pinned rooms + the taped "new board" note.
            Notes spring in one after another, like they're being pinned. */}
        <motion.main
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {rooms.map((room, index) => (
            <motion.div
              key={room.id}
              variants={{
                hidden: { opacity: 0, y: 18, rotate: -2 },
                show: {
                  opacity: 1,
                  y: 0,
                  rotate: 0,
                  transition: { type: "spring", stiffness: 240, damping: 20 },
                },
              }}
            >
              <RoomNote
                room={room}
                index={index}
                onRemoved={(id) =>
                  setRooms((rs) => rs.filter((r) => r.id !== id))
                }
              />
            </motion.div>
          ))}

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: {
                opacity: 1,
                y: 0,
                transition: { type: "spring", stiffness: 240, damping: 20 },
              },
            }}
            className={rooms.length === 0 ? "sm:col-span-2 lg:col-span-2" : ""}
          >
            <NewBoardNote />
          </motion.div>
        </motion.main>

        {/* 🕳 Empty-wall state: nothing pinned yet, nudge them to start one */}
        {!loadingRooms && rooms.length === 0 && (
          <div className="pointer-events-none mt-6 flex items-center gap-3 text-zinc-500">
            <ArrowDoodle ink className="w-16 text-[#8b87f5]" />
            <p className="font-hand text-2xl">
              nothing pinned yet — name one above and start the board
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
