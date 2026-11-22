"use client";

import axios from "axios";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BACKEND_URL } from "../../config";
import { SessionChip } from "../ui/SessionChip";

// Auth-aware landing chrome. Signed out keeps the usual CTAs; signed in
// swaps the navbar for the session chip and quietly empties the footer's
// auth links, because a returning user doesn't need to be sold a sign-in.
export function AuthArea({ variant }: { variant: "nav" | "footer" }) {
  const [userName, setUserName] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/me`, { withCredentials: true })
      .then((res) => setUserName(res.data.user?.name ?? res.data.name ?? null))
      .catch(() => setUserName(null))
      .finally(() => setChecked(true));
  }, []);

  // Stay blank until /me answers so we never flash the wrong state
  if (!checked) return null;

  if (userName) {
    return variant === "nav" ? <SessionChip name={userName} /> : null;
  }

  return variant === "nav" ? (
    <>
      <Link
        href="/signin"
        className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="rounded-lg bg-[#6965db] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5b57c9]"
      >
        Get started
      </Link>
    </>
  ) : (
    <>
      <Link href="/signin" className="transition-colors hover:text-zinc-200">
        Sign in
      </Link>
      <Link href="/signup" className="transition-colors hover:text-zinc-200">
        Create account
      </Link>
    </>
  );
}

// The big "Start drawing" buttons: signed-in users go straight to their
// wall, signed-out ones still get the signup pitch.
export function AuthCta({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/me`, { withCredentials: true })
      .then(() => setSignedIn(true))
      .catch(() => setSignedIn(false));
  }, []);

  return (
    <Link href={signedIn ? "/rooms" : "/signup"} className={className}>
      {children}
    </Link>
  );
}
