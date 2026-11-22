import { WebSocket } from "ws";
import type { User } from "./types.js";

// In-memory pool tracking all active connection windows
export const users: User[] = [];

// Build a room's roster (deduped by userId: one avatar per account, not per
// open tab) and push it to every socket subscribed to that room, sender included.
export function broadcastPresence(roomId: number) {
  const seen = new Map<string, string>();
  users.forEach((user) => {
    if (user.rooms.includes(roomId) && !seen.has(user.userId)) {
      seen.set(user.userId, user.userName);
    }
  });

  const members = Array.from(seen, ([userId, userName]) => ({
    userId,
    userName,
  }));
  const packet = JSON.stringify({
    type: "presence",
    roomId,
    count: members.length,
    members,
  });

  users.forEach((user) => {
    if (user.rooms.includes(roomId) && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(packet);
    }
  });
}
