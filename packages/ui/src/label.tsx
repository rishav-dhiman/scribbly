import type { LabelHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        // ink label written on the paper card
        "block text-xs font-semibold tracking-wide text-[#26234f]/80",
        className,
      )}
      {...props}
    />
  );
}
