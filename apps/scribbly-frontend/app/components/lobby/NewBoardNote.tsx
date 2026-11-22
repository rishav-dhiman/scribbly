"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label } from "@repo/ui";
import { BACKEND_URL } from "../../config";
import { PaperCard } from "../ui/PaperCard";

// 🆕 The taped "pin a new board" note on the lobby wall.
// Owns its own slug state + both actions; the page just renders it.
export function NewBoardNote() {
  const router = useRouter();

  // 📝 One shared slug field for both join and create
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  // 🧼 Slugs are lowercase by the backend schema, so normalize before using them
  function normalizeSlug() {
    return slug.trim().toLowerCase();
  }

  // 🚪 Join an existing room: slug validated via GET /rooms/:slug, then into the canvas
  async function handleJoin() {
    const cleanSlug = normalizeSlug();
    if (!cleanSlug) {
      setError("Enter a room slug first.");
      return;
    }
    setError("");

    try {
      // The GET is just a validation pass — the slug IS the destination URL
      await axios.get(`${BACKEND_URL}/rooms/${cleanSlug}`, {
        withCredentials: true,
      });
      router.push(`/board/${cleanSlug}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          router.push("/signin");
          return;
        }
        if (err.response?.status === 404) {
          setError("No room with that slug — check the spelling or create it.");
          return;
        }
      }
      setError("Network error. Is the backend running?");
    }
  }

  // 🏗️ Create a new room through POST /rooms, then straight into the canvas
  async function handleCreate() {
    const cleanSlug = normalizeSlug();

    // 🛡️ Mirror the backend's CreateRoomSchema so obvious mistakes never hit the network
    if (cleanSlug.length < 3 || !/^[a-z0-9-]+$/.test(cleanSlug)) {
      setError(
        "Slug needs at least 3 characters: lowercase letters, numbers, or hyphens.",
      );
      return;
    }

    setError("");
    setCreating(true);

    try {
      // 🍪 withCredentials sends the httpOnly cookie Express set when you signed in
      const res = await axios.post(
        `${BACKEND_URL}/rooms`,
        { slug: cleanSlug },
        { withCredentials: true },
      );

      // ✅ Room now exists in Postgres -> enter it, the WS join will pass the existence check
      router.push(`/board/${cleanSlug}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        // 🔐 Cookie invalid or expired -> send them back to sign in
        if (err.response?.status === 401 || err.response?.status === 403) {
          router.push("/signin");
          return;
        }

        // ♻️ Slug already taken -> point them at Join rather than failing silently
        if (err.response?.status === 409) {
          setError("That room already exists - use Join instead.");
          return;
        }

        // ❌ Show backend validation messages (e.g. bad slug format)
        if (err.response?.data?.message) {
          setError(String(err.response.data.message));
          return;
        }
      }

      setError("Network error. Is the backend running?");
    } finally {
      setCreating(false);
    }
  }

  return (
    <PaperCard tilt={-1.2} className="w-full p-5">
      <h2 className="font-hand text-3xl font-semibold leading-none text-[#26234f]">
        pin a new board
      </h2>
      <p className="mt-1 text-xs text-[#26234f]/60">
        Name it, create it, share the slug — or join one that already exists.
      </p>

      {/* 🚨 Error banner (only rendered when something failed) */}
      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {/* 🏷️ Slug field shared by both actions */}
      <Label className="mt-4">
        Room slug
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          type="text"
          placeholder="e.g. test-room"
          className="mt-1"
        />
      </Label>
      <span className="mt-1 block font-hand text-base leading-tight text-[#8a6d1d]">
        lowercase letters, numbers, hyphens (min 3)
      </span>

      {/* 🎛️ Create = API call + navigate; Join = slug lookup + navigate */}
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          onClick={handleCreate}
          disabled={creating}
          className="flex-1"
        >
          {creating ? "Creating..." : "Create room"}
        </Button>
        <Button onClick={handleJoin} className="flex-1">
          Join
        </Button>
      </div>
    </PaperCard>
  );
}
