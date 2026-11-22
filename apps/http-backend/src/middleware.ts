import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { SECRET } from "@repo/backend-config";

interface DecodedToken {
  userId: string;
}

// Runs before every protected route, rejecting requests without a valid JWT
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // The browser attaches the httpOnly cookie automatically
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ message: "Unauthorized: Missing token" });
    return;
  }

  try {
    // Verifies the signature AND the expiry, throwing on either failure
    const decoded = jwt.verify(token, SECRET) as DecodedToken;

    // Guard against a valid signature with a malformed payload
    if (!decoded?.userId) {
      res.status(401).json({ message: "Unauthorized: Invalid token payload" });
      return;
    }

    // Pass the real database id to the route via res.locals
    res.locals.userId = decoded.userId;
    next();
  } catch {
    // 403 = token was present but is invalid/expired
    res.status(403).json({ message: "Forbidden: Invalid or expired token" });
  }
};
