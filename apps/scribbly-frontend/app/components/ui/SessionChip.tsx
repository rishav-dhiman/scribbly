"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { BACKEND_URL } from "../../config";
import { PenIcon } from "./icons";

// Who is holding the marker: a taped sticky-note chip + a paper sticker
// sign-out button. Shared by the wall header and the landing navbar.
export function SessionChip({ name }: { name: string }) {
  const router = useRouter();

  // Sign out: clears the cookie server-side, then back to signin
  async function handleLogout() {
    try {
      await axios.post(`${BACKEND_URL}/logout`, {}, { withCredentials: true });
    } finally {
      router.push("/signin");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="flex -rotate-1 select-none items-center gap-1.5 border border-amber-300/60 bg-[#f3e3a3] px-3 py-1 font-hand text-base font-semibold text-[#3f3310] shadow-lg">
        <PenIcon className="h-3.5 w-3.5" />
        {name || "…"}
      </span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Sign out
      </Button>
    </div>
  );
}
