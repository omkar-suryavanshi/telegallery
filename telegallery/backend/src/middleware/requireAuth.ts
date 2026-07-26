import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function cookieOptions() {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.clearCookie(env.COOKIE_NAME, cookieOptions());
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
}

export function issueAuthCookie(res: Response, userId: string) {
  // Newer @types/jsonwebtoken versions type `expiresIn` as a narrow template-literal
  // type (e.g. "30d") rather than a plain `string`. Our value comes from an env var and
  // is always a valid duration string at runtime, so a type cast here is safe.
  const token = jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
  res.cookie(env.COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions());
}
