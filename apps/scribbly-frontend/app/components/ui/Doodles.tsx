// Hand-drawn SVG marks in the landing's ink style.
// Purely presentational: no state, no events. `ink` makes paths draw themselves
// on mount (see globals.css). Use currentColor so callers set the ink color.

type DoodleProps = {
  className?: string;
  ink?: boolean;
};

// A curved arrow, like someone sketched "look over here" on the board.
export function ArrowDoodle({ className = "", ink = false }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 12 C 40 4, 78 14, 96 44 M 96 44 l -18 -8 M 96 44 l -6 -20"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={ink ? "ink" : undefined}
      />
    </svg>
  );
}

// A wobbly underline for emphasizing a handwritten word.
export function UnderlineDoodle({ className = "", ink = false }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 14"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 9 C 22 3, 40 12, 60 8 S 98 4, 117 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={1}
        className={ink ? "ink" : undefined}
      />
    </svg>
  );
}

// A starburst scribble: the "new!" / "hey!" energy mark.
export function BurstDoodle({ className = "", ink = false }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 60 60"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M30 6 L34 22 L50 18 L38 30 L52 40 L34 38 L32 54 L26 38 L8 42 L20 30 L8 18 L26 22 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        pathLength={1}
        className={ink ? "ink" : undefined}
      />
    </svg>
  );
}

// A loose scribble circle for circling things on paper.
export function CircleDoodle({ className = "", ink = false }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M60 5 C 95 3, 116 14, 115 30 C 114 47, 88 56, 58 55 C 28 54, 5 44, 6 28 C 7 12, 28 6, 66 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        className={ink ? "ink" : undefined}
      />
    </svg>
  );
}
