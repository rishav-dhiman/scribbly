"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";
import { StarfieldBackdrop } from "../ui/Backdrop";
import { BurstDoodle, UnderlineDoodle } from "../ui/Doodles";
import { PaperCard } from "../ui/PaperCard";
import { StickyNote } from "../ui/StickyNote";

// The paper-card shell both auth pages share: dot field, sparkles, washi
// tape, and a way back to the landing page. Pages only supply the form + links.
export function AuthShell({
  title,
  subtitle,
  sticker,
  error,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  sticker: string;
  error: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <StarfieldBackdrop />

      <Link
        href="/"
        className="absolute left-5 top-5 font-hand text-lg text-zinc-400 transition-colors hover:text-[#8b87f5]"
      >
        ← just here to doodle?
      </Link>

      {/* Paper card: cream panel, straightens itself on hover. The motion
          wrapper carries the entrance; the card keeps owning the tilt. */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="w-full max-w-sm"
      >
        <PaperCard className="p-6 pt-8">
        <StickyNote className="absolute -top-5 right-5">{sticker}</StickyNote>
        <BurstDoodle
          ink
          className="absolute -right-3 top-8 w-6 text-[#8b87f5]/70"
        />

        <h1 className="relative inline-block font-hand text-4xl font-semibold leading-none text-[#26234f]">
          {title}
          <UnderlineDoodle
            ink
            className="absolute -bottom-2.5 left-0 w-full text-[#8b87f5]"
          />
        </h1>
        <p className="mt-2.5 text-sm text-[#26234f]/70">{subtitle}</p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-medium text-red-800">
            {error}
          </p>
        )}

        {children}

        {footer}
        </PaperCard>
      </motion.div>
    </div>
  );
}
