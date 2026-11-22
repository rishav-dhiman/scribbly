import type { WebSocket } from "ws";

// 👤 One entry per open connection window (a user with two tabs = two entries,
// same userId — the roster dedupes by userId, see pool.ts)
export interface User {
  ws: WebSocket;
  rooms: number[];
  userId: string;
  userName: string;
}
