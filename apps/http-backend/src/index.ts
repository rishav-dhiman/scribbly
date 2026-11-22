import { createServer } from "http";
import { app } from "./app.js";
import { attachWebSockets } from "ws-backend";

// PORT is injected by hosts like Render; fall back to 3001 locally
const PORT = Number(process.env.PORT) || 3001;
const server = createServer(app);

// Realtime shares this port/origin so the httpOnly login cookie rides the WS handshake.
// Hosting REST and WS on separate hosts breaks auth: cookies are host-scoped.
attachWebSockets(server);

// Start the HTTP + WebSocket server (REST routes live in src/routes/, wired in app.ts)
server.listen(PORT, () =>
  console.log(`HTTP Backend + WebSocket server running on port ${PORT}`),
);
