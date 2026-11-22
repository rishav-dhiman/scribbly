import { Router } from "express";
import type { Request, Response } from "express";
import { prisma } from "@repo/db-package";
import { authMiddleware } from "../middleware.js";

export const chatsRouter: Router = Router();

// Chat history: protected (cookie required), returns the latest 50 messages
chatsRouter.get("/chats/:roomId", authMiddleware, async (req: Request, res: Response) => {
  try {
    // URL params are always strings, so convert and validate
    const roomId = Number(req.params.roomId);

    if (isNaN(roomId)) {
      res
        .status(400)
        .json({ message: "Invalid parameter: roomId must be a number" });
      return;
    }

    // Fetch the 50 MOST RECENT messages (desc), then reverse so the
    // response is still chronological (oldest -> newest) for the client
    const chatHistory = await prisma.chat.findMany({
      where: {
        roomId: roomId,
      },
      orderBy: {
        id: "desc",
      },
      take: 50,
      // Chat rows store only userId, so pull the sender's name along.
      // "join" = one SQL statement (one round trip); the default strategy
      // would fetch the chats first and then the users in a second query (~2x slower to Neon)
      include: {
        user: { select: { name: true } },
      },
      relationLoadStrategy: "join",
    });

    // Shape history rows exactly like live socket messages: { message, userId, userName }
    res.json({
      messages: chatHistory.reverse().map(({ user, ...chat }) => ({
        message: chat.message,
        userId: chat.userId,
        userName: user.name,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch room chat logs:", error);
    res
      .status(500)
      .json({ message: "Internal server error retrieving history logs" });
  }
});
