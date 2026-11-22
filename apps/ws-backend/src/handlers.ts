import { WebSocket } from "ws";
import type { User } from "./types.js";
import { prisma } from "@repo/db-package";
import { WsMessageSchema } from "@repo/zod-config";
import { broadcastPresence, users } from "./pool.js";

// Wires the ws "message" listener for ONE verified connection.
// Receives the socket, its pool entry (mutated as the user joins rooms),
// and the verified userId from the JWT. Keeps index.ts free of protocol logic.
export function registerMessageHandler(
  ws: WebSocket,
  currentUser: User,
  userId: string,
) {
  ws.on("message", async function message(data) {
    try {
      const parsedData = JSON.parse(data.toString());
      const result = WsMessageSchema.safeParse(parsedData);

      // Validation gate: reject malformed packets before they reach the handlers
      if (!result.success) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid payload format. Check the message schema.",
          }),
        );
        return;
      }

      const payload = result.data;

      if (payload.type === "join_room") {
        const roomId = payload.roomId;

        const targetRoom = await prisma.room.findUnique({
          where: { id: roomId },
        });

        if (!targetRoom) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Join failed: Room ${roomId} does not exist.`,
            }),
          );
          return;
        }

        // Idempotent: joining twice is harmless
        if (!currentUser.rooms.includes(roomId)) {
          currentUser.rooms.push(roomId);
          console.log(`User ${userId} subscribed to room: ${roomId}`);
        }

        // Joining IS membership: the room pins itself to this user's wall.
        // Fail-soft, because a wall row must never block the actual room join.
        try {
          await prisma.roomMember.upsert({
            where: { userId_roomId: { userId, roomId } },
            update: {},
            create: { userId, roomId },
          });
        } catch (dbError: any) {
          console.error("Failed to record room membership:", dbError.message);
        }

        // Confirm success even if they were already subscribed
        ws.send(
          JSON.stringify({
            type: "status",
            status: "success",
            message: `Successfully joined room ${roomId}`,
          }),
        );

        // Everyone in the room (including the joiner) learns the new roster
        broadcastPresence(roomId);
      }

      if (payload.type === "chat") {
        const roomId = payload.roomId;
        const message = payload.message;

        // Only members of the room may write to it
        if (currentUser.rooms.includes(roomId)) {
          // Durability gate: persist before broadcasting, so a crash can never
          // leave a message that people saw live but history never stored.
          try {
            await prisma.chat.create({
              data: {
                roomId: roomId,
                message: message,
                userId: userId,
              },
            });
          } catch (dbError: any) {
            console.error("Failed to save chat message:", dbError.message);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Message could not be saved. Please try again.",
              }),
            );
            return; // never broadcast a message that is not in Postgres
          }

          // Broadcast only after the row is committed
          users.forEach((user) => {
            if (
              user.rooms.includes(roomId) &&
              user.ws !== ws &&
              user.ws.readyState === WebSocket.OPEN
            ) {
              user.ws.send(
                JSON.stringify({
                  type: "chat",
                  message: message,
                  roomId: roomId,
                  userId: userId,
                  userName: currentUser.userName,
                }),
              );
            }
          });
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Unauthorized Action: You cannot send messages or draw inside room ${roomId} until you explicitly issue a 'join_room' action for it.`,
            }),
          );
          console.warn(
            `Blocked unauthorized broadcast attempt from User ${userId} targeting room ${roomId}`,
          );
        }
      }

      // Canvas shape finalized -> persist to the Shape table, relay to roommates.
      // Mirrors the chat flow on purpose: same membership gate, same write-then-broadcast order.
      if (payload.type === "draw") {
        const roomId = payload.roomId;
        const shapeJson = payload.message;

        if (currentUser.rooms.includes(roomId)) {
          try {
            await prisma.shape.create({
              data: {
                roomId: roomId,
                shape: shapeJson,
                userId: userId,
              },
            });
          } catch (dbError: any) {
            console.error("Failed to save canvas shape:", dbError.message);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Shape could not be saved. Please try again.",
              }),
            );
            return;
          }

          // Relay to everyone else in the room (the drawer already rendered it locally)
          users.forEach((user) => {
            if (
              user.rooms.includes(roomId) &&
              user.ws !== ws &&
              user.ws.readyState === WebSocket.OPEN
            ) {
              user.ws.send(
                JSON.stringify({
                  type: "draw",
                  message: shapeJson,
                  roomId: roomId,
                  userId: userId,
                  userName: currentUser.userName,
                }),
              );
            }
          });
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Unauthorized Action: You cannot draw inside room ${roomId} until you explicitly issue a 'join_room' action for it.`,
            }),
          );
        }
      }
      // Live cursor. Ephemeral presence, NOT content: no database write,
      // no history, no echo to the sender (their own pointer is already
      // on screen). Membership is the only gate, same as draw/chat.
      if (payload.type === "cursor") {
        const roomId = payload.roomId;

        if (currentUser.rooms.includes(roomId)) {
          const packet = JSON.stringify({
            type: "cursor",
            roomId,
            x: payload.x,
            y: payload.y,
            userId,
            userName: currentUser.userName,
          });
          users.forEach((user) => {
            if (
              user.rooms.includes(roomId) &&
              user.ws !== ws &&
              user.ws.readyState === WebSocket.OPEN
            ) {
              user.ws.send(packet);
            }
          });
        }
      }
      // Canvas shape deleted -> remove the matching row, relay to roommates.
      // The packet carries the shape's own JSON (same addressing as draw); identical
      // twins are indistinguishable on screen anyway, so deleting the most recent
      // match keeps every client consistent.
      if (payload.type === "erase") {
        const roomId = payload.roomId;
        const shapeJson = payload.message;

        if (currentUser.rooms.includes(roomId)) {
          const row = await prisma.shape.findFirst({
            where: { roomId: roomId, shape: shapeJson },
            orderBy: { id: "desc" },
          });

          if (!row) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Erase failed: shape not found in this room.",
              }),
            );
            return;
          }

          try {
            await prisma.shape.delete({ where: { id: row.id } });
          } catch (dbError: any) {
            console.error("Failed to delete canvas shape:", dbError.message);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Shape could not be deleted. Please try again.",
              }),
            );
            return;
          }

          // Relay to everyone else in the room (the eraser already removed it locally)
          users.forEach((user) => {
            if (
              user.rooms.includes(roomId) &&
              user.ws !== ws &&
              user.ws.readyState === WebSocket.OPEN
            ) {
              user.ws.send(
                JSON.stringify({
                  type: "erase",
                  message: shapeJson,
                  roomId: roomId,
                }),
              );
            }
          });
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Unauthorized Action: You cannot erase inside room ${roomId} until you explicitly issue a 'join_room' action for it.`,
            }),
          );
        }
      }
    } catch (parseError) {
      console.error("Malformed payload received:", parseError);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Malformed payload format. JSON expected.",
        }),
      );
    }
  });
}
