import { Router } from "express";
import { body } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const prisma = new PrismaClient();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const settings = await prisma.settings.findUnique({ where: { userId: req.userId! } });
    if (!settings) throw new ApiError(404, "Settings not found");
    res.json({ settings });
  })
);

router.patch(
  "/",
  requireAuth,
  body("theme").optional().isIn(["light", "dark", "system"]),
  body("accentColor").optional().isHexColor(),
  body("uploadQuality").optional().isInt({ min: 1, max: 100 }),
  body("autoCompress").optional().isBoolean(),
  body("thumbnailMaxWidth").optional().isInt({ min: 100, max: 2000 }),
  asyncHandler(async (req, res) => {
    const allowed = ["theme", "accentColor", "uploadQuality", "autoCompress", "thumbnailMaxWidth"] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    const settings = await prisma.settings.update({ where: { userId: req.userId! }, data });
    res.json({ settings });
  })
);

export default router;
