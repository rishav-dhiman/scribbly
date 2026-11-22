// Canvas app endpoints. In production both env vars point at the one
// Render origin that serves REST and WebSocket together.
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
