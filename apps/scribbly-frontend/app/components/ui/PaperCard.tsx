import type { ReactNode } from "react";
import { Card } from "@repo/ui";

// A strip of washi tape holding a paper card up.
export function Tape({
  className = "",
  rotate = -3,
}: {
  className?: string;
  rotate?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ transform: `translateX(-50%) rotate(${rotate}deg)` }}
      className={`absolute -top-3 left-1/2 h-6 w-24 bg-[#f3e3a3]/90 shadow-sm ${className}`}
    />
  );
}

// Cream paper panel from the landing CTA, slightly tilted and straightening on hover.
// Pages drop their content in; tape + tilt are optional.
export function PaperCard({
  children,
  className = "",
  tilt = -1,
  taped = true,
}: {
  children: ReactNode;
  className?: string;
  tilt?: number;
  taped?: boolean;
}) {
  return (
    <Card
      style={{ transform: `rotate(${tilt}deg)` }}
      className={`relative border-[#e6dcc0] bg-[#f6f1e4] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] transition-transform duration-300 hover:rotate-0 ${className}`}
    >
      {taped && <Tape />}
      {children}
    </Card>
  );
}
