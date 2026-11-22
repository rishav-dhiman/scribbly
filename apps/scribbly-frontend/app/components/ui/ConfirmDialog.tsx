"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@repo/ui";
import { Tape } from "./PaperCard";

// In-app confirm card that replaces the native window.confirm alert.
// Same paper + tape + hand-font language as the wall notes.
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Keep it",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Esc cancels, exactly like clicking the backdrop
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  // Portal to <body>: the wall notes carry a rotate() transform, which would
  // otherwise trap this fixed overlay inside one note's coordinate box
  return createPortal(
    <AnimatePresence>
      {open && (
        // Backdrop swallows the click so a stray press can't hit the wall
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#26234f]/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotate: -3, y: 16 }}
            animate={{ opacity: 1, scale: 1, rotate: -1.2, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-xl border-2 border-[#26234f]/25 bg-[#fffdf6] p-5 pt-8 shadow-[6px_8px_0_0_rgba(38,35,79,0.55)]"
          >
            <Tape rotate={-3} />

            <h3 className="font-hand text-3xl font-semibold leading-none text-[#26234f]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#26234f]/70">
              {message}
            </p>

            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                {cancelLabel}
              </Button>
              <Button
                onClick={onConfirm}
                disabled={busy}
                className={
                  danger
                    ? "flex-1 border-2 border-red-300 bg-red-100 text-red-700 shadow-[3px_3px_0_0_#7f1d1d] hover:bg-red-200"
                    : "flex-1"
                }
              >
                {busy ? "One sec…" : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
