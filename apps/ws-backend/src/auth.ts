import { parse } from "cookie";

// 🍪 The browser attaches the httpOnly cookie to the WS handshake automatically,
// so the JWT arrives packed inside the "Cookie" header as one long string
export function getCookieToken(cookieHeader: string | undefined): string | null {
  // 🚪 No cookie header at all (manual client or unauthenticated browser) -> nothing to extract
  if (!cookieHeader) return null;

  try {
    // 🧰 RFC 6265 parsing: splits pairs, trims whitespace, handles quotes,
    // and percent-decodes values (a bad encoding falls back to the raw value)
    const cookies = parse(cookieHeader);
    return cookies.token ?? null;
  } catch (error) {
    // 🛡️ Defensive fallback: a header the parser rejects behaves like a missing cookie
    console.error("Failed to parse cookie header:", error);
    return null;
  }
}
