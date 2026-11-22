import { createServer } from "http";
import { attachWebSockets } from "./index.js";

// 🏠 Standalone entrypoint for LOCAL DEV only (root `pnpm dev` runs the three apps separately).
// Hosted deployments run realtime inside http-backend via attachWebSockets().
const PORT = Number(process.env.PORT) || 8080;
const server = createServer();
attachWebSockets(server);

server.on("error", (error: any) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `❌ WebSocket Server failed to start: Port ${PORT} is already in use!`,
    );
  } else {
    console.error("💥 WebSocket Server crashed during startup:", error.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`⚡ Real-time WebSocket Server running on port ${PORT}`);
});
