import fs from "fs";
import { Router } from "express";
import { query, param, validationResult } from "express-validator";
import { PrismaClient, Prisma } from "@prisma/client";
import { FileKind } from "../types/fileKind";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { upload } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rateLimiters";
import { withUserClient } from "../telegram/sessionClient";
import { uploadFileToTelegram, downloadFileBytes } from "../telegram/fileService";
import { buildChannelPeer } from "../telegram/channelService";

const router = Router();
const prisma = new PrismaClient();

function checkValidation(req: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new ApiError(400, errors.array()[0].msg as string);
}

async function getUserOrThrow(userId: string | undefined) {
  if (!userId) throw new ApiError(401, "Not authenticated");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.channelId || !user.channelAccessHash) {
    throw new ApiError(400, "Storage channel not provisioned for this account");
  }
  return user;
}

// POST /files/upload
router.post(
  "/upload",
  requireAuth,
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file provided (expected multipart field 'file')");
    const user = await getUserOrThrow(req.userId);

    try {
      const result = await withUserClient(user.encryptedSession, (client) =>
        uploadFileToTelegram(client, {
          userId: user.id,
          channelId: user.channelId!,
          channelAccessHash: user.channelAccessHash!,
          localFilePath: req.file!.path,
          originalName: req.file!.originalname,
          mimeType: req.file!.mimetype,
          sizeBytes: req.file!.size,
        })
      );

      res.status(result.duplicate ? 200 : 201).json({
        duplicate: result.duplicate,
        file: result.file,
      });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  })
);

// GET /files — list/search with filters + pagination
router.get(
  "/",
  requireAuth,
  query("page").optional().isInt({ min: 1 }),
  query("pageSize").optional().isInt({ min: 1, max: 200 }),
  query("kind").optional().isIn(Object.values(FileKind)),
  query("favorite").optional().isBoolean(),
  query("trashed").optional().isBoolean(),
  query("q").optional().isString(),
  query("minSize").optional().isInt(),
  query("maxSize").optional().isInt(),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
  asyncHandler(async (req, res) => {
    checkValidation(req);
    const userId = req.userId!;
    const page = parseInt((req.query.page as string) ?? "1", 10);
    const pageSize = parseInt((req.query.pageSize as string) ?? "50", 10);

    const where: Prisma.FileWhereInput = {
      userId,
      isTrashed: req.query.trashed === "true",
    };
    if (req.query.kind) where.kind = req.query.kind as FileKind;
    if (req.query.favorite === "true") where.isFavorite = true;
    if (req.query.q) where.originalName = { contains: req.query.q as string };
    if (req.query.minSize || req.query.maxSize) {
      where.sizeBytes = {
        ...(req.query.minSize ? { gte: parseInt(req.query.minSize as string, 10) } : {}),
        ...(req.query.maxSize ? { lte: parseInt(req.query.maxSize as string, 10) } : {}),
      };
    }
    if (req.query.from || req.query.to) {
      where.uploadedAt = {
        ...(req.query.from ? { gte: new Date(req.query.from as string) } : {}),
        ...(req.query.to ? { lte: new Date(req.query.to as string) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.file.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

// GET /files/:id/download — proxies the original bytes from Telegram
router.get(
  "/:id/download",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const user = await getUserOrThrow(req.userId);
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!file) throw new ApiError(404, "File not found");

    const bytes = await withUserClient(user.encryptedSession, (client) =>
      downloadFileBytes(client, file.telegramChannelId, user.channelAccessHash!, file.telegramMessageId)
    );

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(bytes);
  })
);

// GET /files/:id/thumbnail — proxies the compressed thumbnail
router.get(
  "/:id/thumbnail",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const user = await getUserOrThrow(req.userId);
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!file) throw new ApiError(404, "File not found");
    if (!file.thumbnailMessageId) throw new ApiError(404, "No thumbnail available for this file");

    const bytes = await withUserClient(user.encryptedSession, (client) =>
      downloadFileBytes(client, file.telegramChannelId, user.channelAccessHash!, file.thumbnailMessageId!)
    );

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(bytes);
  })
);

// PATCH /files/:id/favorite — toggle favorite
router.patch(
  "/:id/favorite",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!file) throw new ApiError(404, "File not found");
    const updated = await prisma.file.update({
      where: { id: file.id },
      data: { isFavorite: !file.isFavorite },
    });
    res.json({ file: updated });
  })
);

// DELETE /files/:id — move to trash (soft delete)
router.delete(
  "/:id",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!file) throw new ApiError(404, "File not found");
    const updated = await prisma.file.update({
      where: { id: file.id },
      data: { isTrashed: true, trashedAt: new Date() },
    });
    res.json({ file: updated });
  })
);

// POST /files/:id/restore — restore from trash
router.post(
  "/:id/restore",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!file) throw new ApiError(404, "File not found");
    const updated = await prisma.file.update({
      where: { id: file.id },
      data: { isTrashed: false, trashedAt: null },
    });
    res.json({ file: updated });
  })
);

// DELETE /files/:id/permanent — permanently delete DB record (Telegram messages are
// left in the channel by default so the user can still recover via Telegram itself;
// pass ?purgeTelegram=true to also delete the underlying Telegram messages).
router.delete(
  "/:id/permanent",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const user = await getUserOrThrow(req.userId);
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!file) throw new ApiError(404, "File not found");

    if (req.query.purgeTelegram === "true") {
      await withUserClient(user.encryptedSession, async (client) => {
        const ids = [file.telegramMessageId, file.thumbnailMessageId].filter(Boolean) as number[];
        const channelPeer = buildChannelPeer(file.telegramChannelId, user.channelAccessHash!);
        await client.deleteMessages(channelPeer, ids, { revoke: true });
      });
    }

    await prisma.file.delete({ where: { id: file.id } });
    res.json({ success: true });
  })
);

export default router;
