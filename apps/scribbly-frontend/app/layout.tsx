import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

// Caveat powers the sticker notes and hand-written annotations across the site
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Scribbly — sketch together",
  description:
    "A hand-drawn whiteboard for diagrams, wireframes and architecture chats — shared live in a room.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${caveat.variable} h-full antialiased`}
    >
      {/* Extensions inject attributes (e.g. ColorZilla's cz-shortcut-listen); ignore that hydration noise */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
