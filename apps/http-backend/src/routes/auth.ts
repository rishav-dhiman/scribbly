import { Router } from "express";
import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "@repo/db-package";
import { SECRET } from "@repo/backend-config";
import { authMiddleware } from "../middleware.js";
import {
  SignUpSchema,
  type SignUpParams,
  SignInSchema,
  type SignInParams,
} from "@repo/zod-config";

// Shared cookie settings for /signup and /signin
const isProduction = process.env.NODE_ENV === "production";

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true, // browser JS cannot read this cookie (XSS protection)
  // Locally, frontend and API share "localhost" (same-site), so lax is enough.
  // Hosted, they sit on different domains, so the browser treats the cookie as
  // cross-site and only sends it with "none" (which requires secure/HTTPS).
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction, // HTTPS-only in prod; local dev is http
  maxAge: 24 * 60 * 60 * 1000, // matches the JWT's 24h expiry
};

// Clearing must repeat the same attributes, or cross-site browsers keep the old cookie
const CLEAR_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: COOKIE_OPTIONS.sameSite,
  secure: isProduction,
  path: "/",
};

export const authRouter: Router = Router();

// Signup: validate -> reject duplicate email -> hash password -> create user -> auto-login
authRouter.post("/signup", async (req: Request, res: Response) => {
  const body = req.body as SignUpParams;
  const result = SignUpSchema.safeParse(body);

  if (!result.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: result.error.format(),
    });
    return;
  }

  const { email, password, name } = result.data;

  try {
    // Emails are unique in the schema, so reject duplicates with 409
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: "Email is already registered" });
      return;
    }

    // Never store plain passwords: hash with bcrypt (cost factor 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });

    // Auto sign-in after signup: sign a JWT and attach it as an httpOnly cookie
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "24h" });
    res.cookie("token", token, COOKIE_OPTIONS);

    res.status(201).json({ message: "User signed up successfully!" });
  } catch {
    res.status(500).json({ message: "Internal registration error" });
  }
});

// Signin: validate -> find user -> compare bcrypt hash -> sign token -> set cookie
authRouter.post("/signin", async (req: Request, res: Response) => {
  // Only basic shape checks here (email format, password length)
  const body = req.body as SignInParams;
  const result = SignInSchema.safeParse(body);

  if (!result.success) {
    res.status(400).json({ message: "Invalid email or password format" });
    return;
  }

  const { email, password } = result.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // Same message as a wrong password on purpose: never reveal which one failed
    if (!user) {
      res
        .status(401)
        .json({ message: "Invalid email or password credentials" });
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      res
        .status(401)
        .json({ message: "Invalid email or password credentials" });
      return;
    }

    // Sign a fresh 24h token and hand it back as an httpOnly cookie
    // (the token is deliberately NOT in the JSON body: JS must never see it)
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: "24h" });
    res.cookie("token", token, COOKIE_OPTIONS);

    res.json({ message: "Signed in successfully" });
  } catch {
    res.status(500).json({ message: "Internal sign-in error" });
  }
});

// Who am I: the Next server components call this to validate a session.
// The JWT signature alone is not enough, because the account could have been deleted
// (e.g. after a database reset), so we also confirm the user row still exists.
authRouter.get("/me", authMiddleware, async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: res.locals.userId },
      select: { id: true, email: true, name: true, photo: true },
    });

    // Token was valid but its user is gone, so the session is dead
    if (!user) {
      res.clearCookie("token", CLEAR_COOKIE_OPTIONS); // remove the useless cookie so the browser stops sending it
      res
        .status(401)
        .json({ message: "Session expired: account no longer exists" });
      return;
    }

    res.json({ user });
  } catch {
    res.status(500).json({ message: "Internal error loading the current user" });
  }
});

// Logout: clearing the cookie is enough, the browser stops sending the token.
// Deliberately not behind authMiddleware, so signing out always succeeds.
authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", CLEAR_COOKIE_OPTIONS);
  res.json({ message: "Signed out successfully" });
});
