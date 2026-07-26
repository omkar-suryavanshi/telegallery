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

/**
 * Auth works two ways, checked in this order:
 *   1. `Authorization: Bearer <token>` header — the primary mechanism. It works
 *      identically in every browser because it isn't a cookie at all, so it's immune
 *      to third-party cookie blocking (e.g. Safari's Intelligent Tracking Prevention,
 *      which blocks cross-domain cookies outright regardless of SameSite/Secure
 *      settings — a real, unavoidable limitation when the frontend and backend are on
 *      unrelated free-tier domains like vercel.app and onrender.com).
 *   2. The `telegallery_session` cookie — kept as a fallback, mainly convenient for
 *      local development where frontend/backend share "localhost" and cookies just work.
 */
function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  if (typeof req.query.token === "string") {
    return req.query.token;
  }
  return req.cookies?.[env.COOKIE_NAME];
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
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

/** Signs a fresh auth token for the given user — returned to the client to store and
 * send back via the Authorization header on every subsequent request. */
export function signAuthToken(userId: string): string {
  // Newer @types/jsonwebtoken versions type `expiresIn` as a narrow template-literal
  // type (e.g. "30d") rather than a plain `string`. Our value comes from an env var and
  // is always a valid duration string at runtime, so a type cast here is safe.
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** Also sets the cookie, purely as a convenience fallback for local/same-site dev. */
export function issueAuthCookie(res: Response, token: string) {
  res.cookie(env.COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions());
}
