import express from "express";
import type { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { roomsRouter } from "./routes/rooms.js";
import { chatsRouter } from "./routes/chats.js";
import { shapesRouter } from "./routes/shapes.js";

// The express app, fully wired but NOT listening yet.
// index.ts imports this and calls app.listen(): separating "what the app is"
// from "how it starts" means tests (and hosts) can build the app without
// stealing port 3001.
export const app: Express = express();

// CORS: the Next frontend runs on :3000 locally, but a hosted frontend has
// its own origin. FRONTEND_ORIGIN takes a comma-separated list; cookies still
// require exact origins + credentials: true.
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// cookieParser parses the Cookie header so routes can read req.cookies.token
app.use(cookieParser());

// express.json turns JSON request bodies into req.body
app.use(express.json());

// One router per domain: each file in routes/ owns a slice of the URL space
app.use(authRouter); //   /signup /signin /me /logout
app.use(roomsRouter); //  /rooms (create + list) /rooms/:slug (lookup)
app.use(chatsRouter); //  /chats/:roomId
app.use(shapesRouter); // /shapes/:roomId
