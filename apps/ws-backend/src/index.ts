import { WebSocketServer } from "ws";
import { handleConnection } from "./connection.js";

// 🧱 maxPayload caps every incoming frame at 64KB, so one giant packet can't swallow server memory
// 🔢 PORT lets hosts (Render/Railway/Fly) inject their own port; local default is 8080
const PORT = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: PORT, maxPayload: 64 * 1024 });

// 🟢 Fires ONLY if the port binds and initializes successfully
wss.on("listening", () => {
  console.log(`⚡ Real-time WebSocket Server running on port ${PORT}`);
});

// 🔴 Intercepts server startup failures (like port blocking) gracefully
wss.on("error", (error: any) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `❌ WebSocket Server failed to start: Port ${PORT} is already in use!`,
    );
  } else {
    console.error("💥 WebSocket Server crashed during startup:", error.message);
  }
  process.exit(1);
});

// 🤝 Per-connection logic (auth, pool registration, message handler) lives in connection.ts
wss.on("connection", handleConnection);
