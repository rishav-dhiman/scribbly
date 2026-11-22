import Link from "next/link";
import { CopyLink } from "./components/CopyLink";
import { InteractiveBoard } from "./components/InteractiveBoard";
import { AuthArea, AuthCta } from "./components/landing/AuthLinks";

// Four-point sparkle: the running doodle through the page
function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M12 1.5c1.5 5.2 4.3 8 9.5 9.5-5.2 1.5-8 4.3-9.5 9.5C10.5 15.3 7.7 12.5 2.5 11 7.7 9.5 10.5 6.7 12 1.5Z" />
    </svg>
  );
}

// Hand-drawn underline for the headline
function Scribble({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className={className}
    >
      <path d="M3 10c30-7 60-8 90-4 24 3 44 5 70 1 20-3 36-4 54-1" />
    </svg>
  );
}

// A wobbly arrow for annotations
function DoodleArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 60"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8c26 2 44 16 52 38" />
      <path d="M44 44l14 4 4-14" />
    </svg>
  );
}

const ticker = [
  "draw it",
  "talk it out",
  "ship it",
  "v2, maybe?",
  "no meetings",
  "just a room link",
];

const steps = [
  {
    n: "1",
    title: "Open a room",
    body: "Pick a slug, or join one someone sent you.",
    paper: "-rotate-3 bg-[#f3e3a3]",
  },
  {
    n: "2",
    title: "Share the link",
    body: "Anyone signed in lands on the same canvas.",
    paper: "rotate-2 bg-[#bfe8d0]",
  },
  {
    n: "3",
    title: "Sketch and ship",
    body: "Draw the thing, talk it through, send it.",
    paper: "-rotate-2 bg-[#c9c6ff]",
  },
];

function TickerGroup() {
  return (
    <div className="flex shrink-0 items-center">
      {ticker.map((word) => (
        <span
          key={word}
          className="flex items-center gap-7 px-7 font-hand text-2xl whitespace-nowrap text-white sm:text-3xl"
        >
          {word}
          <Sparkle className="h-3.5 w-3.5 text-white/60" />
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 -rotate-6 items-center justify-center rounded-[10px] bg-[#6965db] font-hand text-xl font-bold leading-none text-white shadow-[2px_2px_0_0_#4a47a3] ring-1 ring-white/20 transition-transform duration-300 group-hover:rotate-3">
              S
            </span>
            <span className="font-hand text-2xl font-semibold leading-none text-zinc-100">
              Scribbly
            </span>
            <span className="hidden rotate-3 rounded-sm bg-[#f3e3a3] px-1.5 py-0.5 font-hand text-sm font-semibold text-[#3f3310] shadow-[1px_1px_0_0_rgba(0,0,0,0.35)] sm:inline">
              beta-ish
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#features"
              className="hidden rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 sm:block"
            >
              Features
            </a>
            <a
              href="#how"
              className="hidden rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-zinc-100 sm:block"
            >
              How it works
            </a>
            <AuthArea variant="nav" />
          </nav>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col">
        {/* Hero: the headline is a thought, the board is the proof */}
        <section className="relative mx-auto grid w-full max-w-6xl items-center gap-16 px-6 pt-14 pb-20 lg:grid-cols-[0.92fr_1.08fr] lg:pt-24">
          {/* faint dot field behind the copy, so the canvas shows through */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[26px_26px] mask-[linear-gradient(to_bottom,black,transparent_85%)]"
          />

          <div className="relative min-w-0">
            <Sparkle className="absolute -top-3 -left-5 h-6 w-6 animate-float text-violet-400/70" />

            <p className="font-hand text-2xl -rotate-1 text-violet-300">
              whiteboards shouldn&rsquo;t feel like work
            </p>

            <h1 className="mt-3 text-[clamp(2.7rem,5vw,4.1rem)] leading-[0.98] font-semibold tracking-tight text-balance text-zinc-50">
              Make a mess.
              <br />
              Make it{" "}
              <span className="relative inline-block">
                clear.
                <Scribble className="absolute -bottom-3 left-0 h-3.5 w-full text-[#f3e3a3]" />
              </span>
            </h1>

            <p className="mt-8 max-w-md text-base leading-relaxed text-pretty text-zinc-400">
              Boxes, arrows, sticky notes and the chat that turns a scribble into
              a plan — with everyone on the same canvas, live.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <AuthCta className="inline-flex items-center gap-2 rounded-lg bg-[#6965db] px-6 py-3 text-sm font-semibold text-white shadow-[3px_3px_0_0_#27272a] transition-all hover:-translate-y-0.5 hover:bg-[#5b57c9] hover:shadow-[4px_4px_0_0_#27272a]">
                Start drawing
                <span aria-hidden="true">→</span>
              </AuthCta>
              <a
                href="#board"
                className="group inline-flex items-center gap-2 font-hand text-xl text-zinc-300 transition-colors hover:text-white"
              >
                or doodle on the demo
                <span className="transition-transform group-hover:translate-y-0.5">
                  ↓
                </span>
              </a>
            </div>

            <p className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-wider text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f3e3a3]" />
                free
              </span>
              <span className="text-zinc-700">/</span>
              <span>no install</span>
              <span className="text-zinc-700">/</span>
              <span>just a room link</span>
            </p>
          </div>

          <div id="board" className="relative min-w-0 scroll-mt-24 lg:-rotate-1 lg:transition-transform lg:duration-500 lg:hover:rotate-0">
            {/* washi tape */}
            <span
              aria-hidden="true"
              className="absolute -top-3 left-12 z-20 h-6 w-28 -rotate-6 border border-amber-200/50 bg-[#f3e3a3]/85"
            />
            <span
              aria-hidden="true"
              className="absolute -right-2 -bottom-5 z-20 rotate-3 rounded-sm border border-amber-300/50 bg-[#f3e3a3] px-3 py-1 font-hand text-lg font-semibold text-[#3f3310] shadow-[2px_2px_0_0_#27272a]"
            >
              your ideas, less lonely
            </span>

            <div className="pointer-events-none absolute -top-10 right-2 z-20 hidden items-start gap-1 text-amber-200 lg:flex">
              <span className="rotate-2 font-hand text-xl">
                this board is real, poke it
              </span>
              <DoodleArrow className="h-9 w-11 rotate-90 text-amber-200/80" />
            </div>

            <InteractiveBoard />
          </div>
        </section>

        <div className="relative -rotate-1 overflow-hidden border-y border-black/30 bg-[#6965db] py-3">
          <div className="flex w-max animate-marquee">
            <TickerGroup />
            <TickerGroup />
          </div>
        </div>

        <section id="features" className="scroll-mt-24 py-24">
          <div className="mx-auto w-full max-w-6xl px-6">
            <p className="font-hand text-2xl text-amber-200">
              the good stuff <span aria-hidden="true">↓</span>
            </p>
            <h2 className="mt-1 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-zinc-50 sm:text-4xl">
              Everything a whiteboard should do —{" "}
              <span className="font-hand text-[1.15em] text-violet-300">
                and nothing it shouldn&rsquo;t.
              </span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
              No workspace inside your workspace. One canvas, one room, one chat
              — and it all stays where you left it.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 sm:col-span-2 lg:col-span-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100">
                      Infinite canvas
                    </h3>
                    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-400">
                      Pan, zoom, and never run out of room. Rectangles, arrows,
                      text, freehand — all a drag away.
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-zinc-600">
                    01 / CANVAS
                  </span>
                </div>

                <div className="relative mt-6 h-40 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e]">
                  <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.10)_1px,transparent_1px)] bg-size-[16px_16px]" />
                  <svg
                    viewBox="0 0 420 160"
                    className="absolute inset-0 h-full w-full"
                    fill="none"
                    stroke="#a1a1aa"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="28" y="34" width="110" height="46" rx="8" />
                    <rect x="238" y="76" width="120" height="46" rx="8" />
                    <path d="M138 57c34 0 60 20 96 28" />
                    <path d="M224 76l12 9-14 6" />
                    <path d="M60 116q24-14 48 0t48 0" stroke="#8b87f5" strokeWidth="2" />
                    <path
                      d="M356 24l6 12 12 6-12 6-6 12-6-12-12-6 12-6z"
                      stroke="#f3e3a3"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="absolute right-4 bottom-3 -rotate-3 font-hand text-lg text-zinc-500">
                    keep going →
                  </span>
                </div>
              </article>

              <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 sm:col-span-2 lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Draw together
                  </h3>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-600">
                    02
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  Cursors appear as people join. Strokes land as they&rsquo;re
                  drawn, not after a refresh.
                </p>

                <div className="relative mt-8 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded bg-[#6965db] px-2 py-1 font-mono text-[10px] text-white">
                    <Sparkle className="h-2.5 w-2.5" /> you
                  </span>
                  <span className="flex items-center gap-1 rounded bg-emerald-500 px-2 py-1 font-mono text-[10px] text-emerald-950">
                    <Sparkle className="h-2.5 w-2.5" /> riya
                  </span>
                  <span className="font-hand text-lg text-zinc-500">
                    = no refresh, promise
                  </span>
                </div>
              </article>

              <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Talk while you draw
                  </h3>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-600">
                    03
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  A chat panel sits beside every board, so the diagram and the
                  conversation stay together.
                </p>

                <div className="mt-6 space-y-2">
                  <p className="w-fit max-w-[85%] rounded-xl rounded-bl-sm border border-white/10 bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-300">
                    should this box be a service?
                  </p>
                  <p className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-[#6965db] px-3 py-1.5 text-xs text-white">
                    ship it, we&rsquo;ll split it later
                  </p>
                  <span className="flex w-fit items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
                    <span className="animate-pulse-soft h-1 w-1 rounded-full bg-zinc-500" />
                    <span
                      className="animate-pulse-soft h-1 w-1 rounded-full bg-zinc-500"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span
                      className="animate-pulse-soft h-1 w-1 rounded-full bg-zinc-500"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </span>
                </div>
              </article>

              <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Share a room, not a file
                  </h3>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-600">
                    04
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  Every board lives at a slug you can share, with its own saved
                  history.
                </p>

                <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-950/80 p-2 pl-3">
                  <span className="font-mono text-[11px] text-zinc-400">
                    /board/<span className="text-zinc-100">no-1</span>
                  </span>
                  <CopyLink />
                </div>
                <p className="mt-3 -rotate-1 font-hand text-lg text-amber-200">
                  send it to the group chat
                </p>
              </article>

              <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    Every stroke saved
                  </h3>
                  <span className="font-mono text-[10px] tracking-[0.18em] text-zinc-600">
                    05
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  Close the tab, come back tomorrow — the arrows are still
                  exactly where you left them.
                </p>

                <div className="mt-6 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 font-mono text-[10px] text-emerald-300">
                    ✓
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    saved to room-no-1
                  </span>
                </div>
                <div className="mt-3 flex gap-1">
                  {[36, 52, 44, 60, 48, 68, 56].map((w, i) => (
                    <span
                      key={i}
                      className="h-1.5 rounded-full bg-white/10"
                      style={{ width: w }}
                    />
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* How it works: a doodled path, not a stepper component */}
        <section
          id="how"
          className="relative scroll-mt-24 border-t border-white/5 bg-white/1.5 py-24"
        >
          <div className="mx-auto w-full max-w-6xl px-6">
            <p className="font-hand text-2xl text-emerald-300">
              that&rsquo;s it, seriously
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Three steps. Then you&rsquo;re{" "}
              <span className="font-hand text-[1.15em] text-violet-300">
                drawing.
              </span>
            </h2>

            <div className="relative mt-14 grid gap-10 sm:grid-cols-3">
              <svg
                aria-hidden="true"
                viewBox="0 0 900 60"
                className="pointer-events-none absolute -top-8 right-[8%] left-[8%] hidden h-14 w-[84%] text-zinc-700/70 sm:block"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="7 9"
              >
                <path d="M10 40c130-30 250 20 400 0s250-24 390 4" />
              </svg>
              <svg
                aria-hidden="true"
                viewBox="0 0 900 60"
                className="pointer-events-none absolute -top-8 right-[8%] left-[8%] hidden h-14 w-[84%] sm:block"
                fill="none"
                stroke="#8b87f5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeOpacity="0.8"
              >
                <path
                  pathLength={1}
                  className="trail"
                  d="M10 40c130-30 250 20 400 0s250-24 390 4"
                />
              </svg>

              {steps.map((s) => (
                <div key={s.n} className="relative">
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-md border border-black/20 font-hand text-3xl font-bold text-[#262626] shadow-[3px_3px_0_0_#27272a] ${s.paper}`}
                  >
                    {s.n}
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-zinc-100">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA on a sheet of warm paper, taped to the dark page */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="relative overflow-hidden rounded-[28px] border border-black/15 bg-[#f6f1e4] px-8 py-14 text-[#1f1c14] shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95)] sm:px-12">
            {/* tape + doodles */}
            <span
              aria-hidden="true"
              className="absolute -top-2 left-10 h-7 w-28 -rotate-6 border border-black/10 bg-[#6965db]/90"
            />
            <span
              aria-hidden="true"
              className="absolute -top-2 right-12 h-7 w-24 rotate-3 border border-black/10 bg-[#bfe8d0]"
            />
            <Sparkle className="absolute top-8 right-24 h-10 w-10 text-[#6965db]/25" />
            <Sparkle className="absolute bottom-6 left-1/3 h-6 w-6 animate-float text-[#6965db]/30" />
            <svg
              aria-hidden="true"
              viewBox="0 0 160 40"
              className="absolute bottom-4 left-6 w-32 text-[#6965db]/30"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M4 30c20-16 36-16 56 0s36 16 56 0 24-10 40-6" />
            </svg>

            <span className="absolute top-5 right-6 rotate-6 rounded-sm bg-[#f3e3a3] px-3 py-1 font-hand text-lg font-semibold text-[#3f3310] shadow-sm sm:right-10">
              it&rsquo;s free
            </span>

            <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="max-w-md text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Open a board. Invite a friend.
                </h2>
                <p className="mt-2 font-hand text-2xl text-[#6b6252]">
                  the canvas does the rest.
                </p>
              </div>
              <AuthCta className="shrink-0 rounded-lg bg-[#6965db] px-7 py-3.5 text-center text-sm font-semibold text-white shadow-[3px_3px_0_0_#1f1c14] transition-all hover:-translate-y-0.5 hover:bg-[#5b57c9] hover:shadow-[4px_4px_0_0_#1f1c14]">
                Start drawing
              </AuthCta>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex flex-col items-center gap-0.5 sm:items-start">
            <span className="text-xs font-semibold text-zinc-300">
              Scribbly — sketch, collaborate, ship.
            </span>
            <span className="font-hand text-xl text-zinc-500">
              draw first, name it later.
            </span>
          </div>
          <span className="flex items-center gap-5 text-xs text-zinc-500">
            <AuthArea variant="footer" />
          </span>
        </div>
      </footer>
    </div>
  );
}
