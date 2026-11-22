"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui";
import { BACKEND_URL } from "../config";
import { AuthShell } from "../components/auth/AuthShell";

export default function SignInPage() {
  // After a successful sign-in, land on the room lobby (not the landing page)
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // withCredentials lets the browser store the httpOnly cookie Express returns
      await axios.post(
        `${BACKEND_URL}/signin`,
        { email, password },
        { withCredentials: true },
      );

      // Cookie is set -> go to the room lobby
      router.push("/rooms");
    } catch (err) {
      // Show the backend's message (401 wrong creds / 400 bad format), else a network hint
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(String(err.response.data.message));
      } else {
        setError("Network error. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to your rooms."
      sticker="the board missed you"
      error={error}
      footer={
        <>
          <p className="mt-4 text-center text-xs text-[#26234f]/60">
            No account?{" "}
            <Link
              href="/signup"
              className="text-[#5b57c9] underline underline-offset-2"
            >
              Create one
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="mt-4 block text-xs font-semibold tracking-wide text-[#26234f]/80">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[#26234f]/25 bg-[#0c0c0e] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#6965db] focus:ring-2 focus:ring-[#6965db]/30"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold tracking-wide text-[#26234f]/80">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[#26234f]/25 bg-[#0c0c0e] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#6965db] focus:ring-2 focus:ring-[#6965db]/30"
          />
        </label>

        <Button type="submit" disabled={loading} className="mt-5 w-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
