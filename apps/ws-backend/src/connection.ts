import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { SECRET } from "@repo/backend-config";
import { prisma } from "@repo/db-package";
import { getCookieToken } from "./auth.js";
import { broadcastPresence, users } from "./pool.js";
import { registerMessageHandler } from "./handlers.js";
import type { User } from "./types.js";

// Runs once per handshake: authenticates the cookie JWT, registers the
// connection in the pool, then hands the socket to the message handler.
export async function handleConnection(ws: WebSocket, request: IncomingMessage) {
  // Cookie is the only token source: browsers attach it to the WS handshake automatically
  // (cookies are host-scoped, not port-scoped). No ?token= in the URL - query strings leak into logs and proxies.
  const token = getCookieToken(request.headers.cookie) ?? "";

  if (!token) {
    ws.close(1008, "Policy Violation: Missing Token");
    return;
  }

  try {
    const decoded = jwt.verify(token, SECRET) as { userId: string };

    if (!decoded || !decoded.userId) {
      ws.close(1008, "Policy Violation: Invalid Payload");
      return;
    }

    const userId = decoded.userId;

    // Register the user IMMEDIATELY, before any database call:
    // the browser fires join_room the moment the handshake opens; if we awaited
    // the profile lookup first, that fast packet could arrive before the message
    // listener exists and be silently dropped (ws does not buffer for missing listeners).
    const currentUser: User = {
      ws: ws,
      userId: userId,
      userName: "User", // Placeholder until the background profile lookup resolves
      rooms: [],
    };

    users.push(currentUser);

    // Fetch the display name in the background so the hot path never blocks on Neon
    prisma.user
      .findUnique({ where: { id: userId }, select: { name: true } })
      .then((profile) => {
        if (profile?.name) {
          currentUser.userName = profile.name;
          // The roster may already be showing the "User" placeholder,
          // so push a refresh to give roommates the real name
          currentUser.rooms.forEach((roomId) => broadcastPresence(roomId));
        }
      })
      .catch((error: any) => {
        console.error("Could not load user profile name:", error.message);
      });

    registerMessageHandler(ws, currentUser, userId);

    ws.on("close", () => {
      console.log(`Cleaning up memory for disconnected user: ${userId}`);
      const departed = users.find((u) => u.ws === ws);
      if (!departed) return;
      users.splice(users.indexOf(departed), 1);
      // each remaining roommate sees the count drop in real time
      departed.rooms.forEach((roomId) => broadcastPresence(roomId));
    });
  } catch (error) {
    // Expired or corrupted signatures close the socket instead of crashing the process
    ws.close(1008, "Policy Violation: Token Expired or Invalid");
    return;
  }
}
