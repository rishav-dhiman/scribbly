import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // cream paper note pinned on the dark board, ink text, hard offset shadow
        "rounded-xl border border-[#e6dcc0] bg-[#f6f1e4] text-[#26234f] shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]",
        className,
      )}
      {...props}
    />
  );
}
