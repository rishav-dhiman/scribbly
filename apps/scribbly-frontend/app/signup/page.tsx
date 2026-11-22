"use client";

import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui";
import { BACKEND_URL } from "../config";
import { AuthShell } from "../components/auth/AuthShell";

export default function SignUpPage() {
  // After signup the backend has already signed us in, so go straight to the lobby
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Backend creates the user AND sets the cookie in one call
      await axios.post(
        `${BACKEND_URL}/signup`,
        { name, email, password },
        { withCredentials: true },
      );

      // Already logged in -> go to the room lobby
      router.push("/rooms");
    } catch (err) {
      // Show validation / duplicate-email errors from the backend
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
      title="Create account"
      subtitle="Join rooms and draw together."
      sticker="draw first, name later"
      error={error}
      footer={
        <>
          <p className="mt-4 text-center text-xs text-[#26234f]/60">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="text-[#5b57c9] underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label className="mt-4 block text-xs font-semibold tracking-wide text-[#26234f]/80">
          Name
          <input
            type="text"
            required
            minLength={3}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[#26234f]/25 bg-[#0c0c0e] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#6965db] focus:ring-2 focus:ring-[#6965db]/30"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold tracking-wide text-[#26234f]/80">
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

        {/* Password rules in handwriting, like the landing notes */}
        <label className="mt-3 block text-xs font-semibold tracking-wide text-[#26234f]/80">
          Password
          <input
            type="password"
            required
            minLength={5}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[#26234f]/25 bg-[#0c0c0e] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#6965db] focus:ring-2 focus:ring-[#6965db]/30"
          />
          <span className="mt-1 block font-hand text-base leading-tight text-[#8a6d1d]">
            needs an uppercase letter, a number, and a special character
            (@$!%*?&#)
          </span>
        </label>

        <Button type="submit" disabled={loading} className="mt-5 w-full">
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
