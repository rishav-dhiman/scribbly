import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@repo/db-package";
import { authMiddleware } from "../middleware.js";

export const shapesRouter: Router = Router();

// 🎨 CANVAS HISTORY: protected (cookie required), returns the latest 200 shapes of a room
shapesRouter.get("/shapes/:roomId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
      res
        .status(400)
        .json({ message: "Invalid parameter: roomId must be a number" });
      return;
    }

    // Fetch the 200 MOST RECENT shapes (desc), then reverse to chronological.
    // Shapes get their own, larger history window than chat messages on purpose:
    // a board's worth of drawings is the room's actual state.
    const shapeHistory = await prisma.shape.findMany({
      where: { roomId },
      orderBy: { id: "desc" },
      take: 200,
      include: { user: { select: { name: true } } },
      relationLoadStrategy: "join",
    });

    res.json({
      shapes: shapeHistory.reverse().map(({ user, ...row }) => ({
        id: row.id,
        shape: row.shape,
        userId: row.userId,
        userName: user.name,
      })),
    });
  } catch (error) {
    console.error("❌ Failed to fetch room shapes:", error);
    res
      .status(500)
      .json({ message: "Internal server error retrieving canvas shapes" });
  }
});
