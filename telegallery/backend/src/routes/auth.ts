import { Router } from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { authLimiter } from "../middleware/rateLimiters";
import { requireAuth, issueAuthCookie, clearAuthCookie } from "../middleware/requireAuth";
import { encrypt } from "../utils/crypto";
import {
  sendLoginCode,
  TwoFactorRequiredError,
  verifyLoginCode,
  verifyLoginPassword,
} from "../telegram/authService";
import { getOrCreateStorageChannel } from "../telegram/channelService";

const router = Router();
const prisma = new PrismaClient();

function checkValidation(req: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, errors.array()[0].msg as string);
  }
}

// POST /auth/login — send an OTP to the given phone number
router.post(
  "/login",
  authLimiter,
  body("phone").isMobilePhone("any").withMessage("A valid phone number in international format is required"),
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const { phone } = req.body;
    const { loginToken } = await sendLoginCode(phone);
    res.json({ loginToken });
  })
);

// POST /auth/verify — verify the OTP (and 2FA password if required)
router.post(
  "/verify",
  authLimiter,
  body("loginToken").isString().notEmpty(),
  body("code").optional().isString(),
  body("password").optional().isString(),
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const { loginToken, code, password } = req.body;

    let result;
    try {
      if (password) {
        result = await verifyLoginPassword(loginToken, password);
      } else {
        if (!code) throw new ApiError(400, "code is required");
        result = await verifyLoginCode(loginToken, code);
      }
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        return res.status(200).json({ requires2FA: true, loginToken: err.loginToken });
      }
      throw err;
    }

    const { sessionString, phone, client } = result;

    try {
      const { channelId, accessHash } = await getOrCreateStorageChannel(client);

      const user = await prisma.user.upsert({
        where: { phone },
        create: {
          phone,
          encryptedSession: encrypt(sessionString),
          channelId,
          channelAccessHash: accessHash,
          settings: { create: {} },
        },
        update: {
          encryptedSession: encrypt(sessionString),
          channelId,
          channelAccessHash: accessHash,
        },
      });

      issueAuthCookie(res, user.id);
      res.json({ success: true, user: { id: user.id, phone: user.phone } });
    } finally {
      await client.disconnect().catch(() => {});
    }
  })
);

// POST /auth/logout
router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  })
);

// GET /auth/me — check current session
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, phone: true, createdAt: true },
    });
    if (!user) throw new ApiError(404, "User not found");
    res.json({ user });
  })
);

export default router;
