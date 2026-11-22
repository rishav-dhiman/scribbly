// The dot-field backdrop shared by the landing hero and auth pages.
// Render inside a `relative overflow-hidden` parent; it fills absolutely.
export function DotField({
  className = "",
  dotOpacity = 0.07,
  size = 22,
}: {
  className?: string;
  dotOpacity?: number;
  size?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 mask-[radial-gradient(ellipse_at_center,black,transparent_75%)] ${className}`}
      style={{
        backgroundImage: `radial-gradient(rgba(255,255,255,${dotOpacity}) 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

// A single hand-drawn sparkle mark, absolutely positioned by the caller.
export function Sparkle({
  className = "",
  children = "✦",
}: {
  className?: string;
  children?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute font-hand ${className}`}
    >
      {children}
    </span>
  );
}

// The full scene: dot field + two sparkles, one violet, one warm.
export function StarfieldBackdrop({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <DotField />
      <Sparkle className="left-[12%] top-[18%] text-3xl text-[#8b87f5]/60">✦</Sparkle>
      <Sparkle className="bottom-[16%] right-[14%] text-2xl text-[#f3e3a3]/50">✦</Sparkle>
    </div>
  );
}
