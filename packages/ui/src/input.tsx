import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        // 🖋️ dark ink field drawn on the paper card, violet scribble on focus
        "w-full rounded-lg border border-[#26234f]/25 bg-[#0c0c0e] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#6965db] focus:ring-2 focus:ring-[#6965db]/30",
        className,
      )}
      {...props}
    />
  );
}
