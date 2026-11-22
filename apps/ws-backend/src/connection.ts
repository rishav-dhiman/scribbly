import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { SECRET } from "@repo/backend-config";
import { prisma } from "@repo/db-package";
import { getCookieToken } from "./auth.js";
import { broadcastPresence, users } from "./pool.js";
import { registerMessageHandler } from "./handlers.js";
import type { User } from "./types.js";

// 🤝 Runs once per handshake: authenticates the cookie JWT, registers the
// connection in the pool, then hands the socket to the message handler.
export async function handleConnection(ws: WebSocket, request: IncomingMessage) {
  // 🔑 Cookie is the only token source: browsers attach it to the WS handshake automatically
  // (cookies are host-scoped, not port-scoped). No ?token= in the URL - query strings leak into logs and proxies.
  const token = getCookieToken(request.headers.cookie) ?? "";

  if (!token) {
    ws.close(1008, "Policy Violation: Missing Token");
    return;
  }

  // 2. CRUCIAL: Wrap jwt.verify inside a try/catch block
  try {
    const decoded = jwt.verify(token, SECRET) as { userId: string };

    // Safety check ensuring the payload contains the key property
    if (!decoded || !decoded.userId) {
      ws.close(1008, "Policy Violation: Invalid Payload");
      return;
    }

    const userId = decoded.userId;

    // 🟢 Register the user IMMEDIATELY, before any database call.
    // Why: the browser fires join_room the moment the handshake opens; if we awaited
    // the profile lookup first, that fast packet could arrive before the message
    // listener exists and be silently dropped (ws does not buffer for missing listeners).
    const currentUser: User = {
      ws: ws,
      userId: userId,
      userName: "User", // 🏷️ Placeholder until the background profile lookup resolves
      rooms: [], // Starts completely empty until they fire a subscribe action
    };

    users.push(currentUser);

    // 🏷️ Fetch the display name in the background so the hot path never blocks on Neon
    prisma.user
      .findUnique({ where: { id: userId }, select: { name: true } })
      .then((profile) => {
        if (profile?.name) {
          currentUser.userName = profile.name;
          // 📣 The roster may already be showing the "User" placeholder —
          // push a refresh so roommates get the real name once it resolves
          currentUser.rooms.forEach((roomId) => broadcastPresence(roomId));
        }
      })
      .catch((error: any) => {
        console.error("❌ Could not load user profile name:", error.message);
      });

    // 3. Begin listening for verified user messages
    registerMessageHandler(ws, currentUser, userId);

    // 🟢 FIXED: Added the cleanup event listener to scrub disconnected users out of memory!
    ws.on("close", () => {
      console.log(`🔌 Cleaning up memory for disconnected user: ${userId}`);
      const departed = users.find((u) => u.ws === ws);
      if (!departed) return;
      users.splice(users.indexOf(departed), 1);
      // 📣 each remaining roommate sees the count drop in real time
      departed.rooms.forEach((roomId) => broadcastPresence(roomId));
    });
  } catch (error) {
    // 💥 Catches expired or corrupted signatures safely, preventing a backend server crash!
    ws.close(1008, "Policy Violation: Token Expired or Invalid");
    return;
  }
}
