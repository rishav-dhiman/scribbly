import { z } from "zod";

export const SignUpSchema = z.object({
  email: z.string().min(3).max(100).email(),
  password: z
    .string()
    .min(5)
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/, // 🟢 Fixed the broken trailing bracket typo
    ),
  name: z.string().min(3).max(100),
});

export const SignInSchema = z.object({
  email: z.string().min(3).max(100).email(),
  password: z.string().min(5).max(100),
});

export const CreateRoomSchema = z.object({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, {
    message: "Slug can only contain lowercase letters, numbers, and hyphens", // 🟢 Changed roomName to slug to match your Prisma model!
  }),
});

// 🟢 Exporting these inference types makes typing request bodies in Express incredibly easy!
export type SignUpParams = z.infer<typeof SignUpSchema>;
export type SignInParams = z.infer<typeof SignInSchema>;
export type CreateRoomParams = z.infer<typeof CreateRoomSchema>;

// 🔌 WebSocket event schemas - single source of truth for every packet the ws-server accepts
// roomId uses coerce so both 123 and "123" string values pass

// 🚪 Client asks to subscribe to a room channel
export const WsJoinRoomSchema = z.object({
  type: z.literal("join_room"), // 🏷️ Discriminator tag: tells the server which action this packet is
  roomId: z.coerce.number().int().positive(), // 🔢 Room must be a positive whole number
});

// 💬 Client broadcasts a chat/draw message into a room it already joined
export const WsChatSchema = z.object({
  type: z.literal("chat"),
  roomId: z.coerce.number().int().positive(),
  message: z.string().min(1).max(2000), // ✍️ Empty spam and oversized text are both rejected here
});

// 🎨 Client finalizes a canvas shape into a room it already joined.
// The shape travels as a JSON string (same wire shape as chat, different table).
export const WsDrawSchema = z.object({
  type: z.literal("draw"),
  roomId: z.coerce.number().int().positive(),
  message: z.string().min(1).max(4000), // 📐 Rect/circle payloads are tiny; headroom for future freehand paths
});

// 🧹 Client deletes a canvas shape: the SAME shape JSON it once drew comes back
// as the address. Symmetric with draw, so no shape-id plumbing is needed.
export const WsEraseSchema = z.object({
  type: z.literal("erase"),
  roomId: z.coerce.number().int().positive(),
  message: z.string().min(1).max(4000),
});

// 🖱️ Live cursor position in WORLD coordinates. Ephemeral by design: never
// persisted, never replayed on join — it's presence, not content.
export const WsCursorSchema = z.object({
  type: z.literal("cursor"),
  roomId: z.coerce.number().int().positive(),
  x: z.number().finite(),
  y: z.number().finite(),
});

// 👥 Server -> client only: who is in a room right now. Never sent by clients,
// so it stays OUT of the inbound union above — it's documentation + a shared type.
export const WsPresenceSchema = z.object({
  type: z.literal("presence"),
  roomId: z.number().int().positive(),
  count: z.number().int().nonnegative(),
  members: z.array(
    z.object({
      userId: z.string(),
      userName: z.string(),
    }),
  ),
});

export type WsPresence = z.infer<typeof WsPresenceSchema>;

// 🧠 discriminatedUnion: zod reads "type" first, then validates with only that one schema
// (instead of trying all three and returning confusing combined errors)
export const WsMessageSchema = z.discriminatedUnion("type", [
  WsJoinRoomSchema,
  WsChatSchema,
  WsDrawSchema,
  WsEraseSchema,
  WsCursorSchema,
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;
