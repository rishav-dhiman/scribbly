import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@repo/db-package";
import { authMiddleware } from "../middleware.js";
import { CreateRoomSchema, type CreateRoomParams } from "@repo/zod-config";

export const roomsRouter: Router = Router();

// Create room: authMiddleware guarantees a valid cookie before this runs
roomsRouter.post("/rooms", authMiddleware, async (req: Request, res: Response) => {
  const body = req.body as CreateRoomParams;
  const result = CreateRoomSchema.safeParse(body);

  if (!result.success) {
    res
      .status(400)
      .json({ message: "Invalid room data", errors: result.error.format() });
    return;
  }

  const { slug } = result.data;

  const currentUserId = res.locals.userId;

  try {
    // Slugs must be unique, otherwise the room URL would be ambiguous
    const existingRoom = await prisma.room.findUnique({ where: { slug } });
    if (existingRoom) {
      res
        .status(409)
        .json({ message: "A room with this unique slug already exists" });
      return;
    }

    const newRoom = await prisma.room.create({
      data: { slug: slug, adminId: currentUserId },
    });

    // The creator is a member of their own room: the wall lists memberships,
    // not raw rooms, so this row is what pins the new board up
    await prisma.roomMember.create({
      data: { userId: currentUserId, roomId: newRoom.id },
    });

    res.json({
      message: `Room '${slug}' created successfully!`,
      roomId: newRoom.id,
      createdBy: currentUserId,
    });
  } catch {
    res.status(500).json({ message: "Failed to create database room entry" });
  }
});

// Room lookup: resolve a slug to the full room record (used by the Next room page)
roomsRouter.get("/rooms/:slug", authMiddleware, async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;

    // Slug is unique, so findUnique is the cheapest lookup
    const room = await prisma.room.findUnique({
      where: {
        slug: slug,
      },
    });

    if (!room) {
      res.status(404).json({ message: "Room not found with the provided slug" });
      return;
    }

    res.json({
      room,
    });
  } catch (error) {
    console.error("Failed to fetch room details by slug:", error);
    res.status(500).json({ message: "Internal server error retrieving room details" });
  }
});

// Room by id removed with the /canvas/[id] legacy redirect; nothing
// resolves ids to slugs anymore (boards are addressed purely by slug)

// My wall: only rooms I created or joined, newest first, with an isOwner flag
roomsRouter.get("/rooms", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const currentUserId = res.locals.userId;

    const rooms = await prisma.room.findMany({
      where: { members: { some: { userId: currentUserId } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        createdAt: true,
        adminId: true,
        _count: { select: { shapes: true } },
      },
    });

    res.json({
      rooms: rooms.map((room) => ({
        ...room,
        isOwner: room.adminId === currentUserId,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    res.status(500).json({ message: "Internal server error retrieving rooms" });
  }
});

// Delete room: permanent, creator-only. Shapes, chats and memberships
// all cascade with the room row.
roomsRouter.delete("/rooms/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isInteger(roomId)) {
      res.status(400).json({ message: "Invalid room id" });
      return;
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    if (room.adminId !== res.locals.userId) {
      res
        .status(403)
        .json({ message: "Only the room's creator can delete it" });
      return;
    }

    await prisma.room.delete({ where: { id: roomId } });
    res.json({ message: `Room '${room.slug}' deleted` });
  } catch (error) {
    console.error("Failed to delete room:", error);
    res.status(500).json({ message: "Internal server error deleting room" });
  }
});

// Leave room: a non-creator member removes the room from THEIR wall only.
// The room, its shapes and its chats all stay alive for everyone else.
roomsRouter.post("/rooms/:id/leave", authMiddleware, async (req: Request, res: Response) => {
  try {
    const roomId = Number(req.params.id);
    if (!Number.isInteger(roomId)) {
      res.status(400).json({ message: "Invalid room id" });
      return;
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    if (room.adminId === res.locals.userId) {
      res
        .status(400)
        .json({ message: "Creators can't leave their own room — delete it instead" });
      return;
    }

    await prisma.roomMember.deleteMany({
      where: { userId: res.locals.userId, roomId },
    });
    res.json({ message: "Room removed from your wall" });
  } catch (error) {
    console.error("Failed to leave room:", error);
    res.status(500).json({ message: "Internal server error leaving room" });
  }
});
