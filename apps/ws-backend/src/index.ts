import type { Server } from "http";
import { WebSocketServer } from "ws";
import { handleConnection } from "./connection.js";

// 🔌 Attach realtime to an existing HTTP server so REST + WS share ONE origin.
// Why: the login cookie is host-scoped, and a cross-host WS handshake never carries it.
// 🧱 maxPayload caps every incoming frame at 64KB, so one giant packet can't swallow server memory
export function attachWebSockets(server: Server) {
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

  // 🔴 Log server-level failures but don't kill the host process - the HTTP app shares it now
  wss.on("error", (error: Error) => {
    console.error("💥 WebSocket server error:", error.message);
  });

  // 🤝 Per-connection logic (auth, pool registration, message handler) lives in connection.ts
  wss.on("connection", handleConnection);

  return wss;
}
