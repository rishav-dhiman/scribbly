import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b87f5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f1e4] disabled:pointer-events-none disabled:opacity-60";

const variants = {
  // violet sticker from the landing CTA: hard offset shadow, lifts on hover, presses flat on click
  solid:
    "bg-[#6965db] text-white shadow-[3px_3px_0_0_#27272a] hover:-translate-y-0.5 hover:bg-[#5b57c9] hover:shadow-[4px_4px_0_0_#27272a] active:translate-y-0 active:shadow-[2px_2px_0_0_#27272a]",
  // outlined sticker for secondary actions, drawn on paper
  outline:
    "border-2 border-[#26234f]/30 bg-[#f6f1e4] text-[#26234f] shadow-[3px_3px_0_0_#27272a] hover:-translate-y-0.5 hover:border-[#26234f]/50 hover:shadow-[4px_4px_0_0_#27272a] active:translate-y-0 active:shadow-[2px_2px_0_0_#27272a]",
  // quiet action that lives on dark surfaces (e.g. the session bar)
  ghost:
    "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-100 disabled:text-zinc-600",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-xs",
  lg: "px-5 py-3 text-sm",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({
  variant = "solid",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
