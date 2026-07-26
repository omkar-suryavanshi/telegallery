import { Router } from "express";
import { body, param } from "express-validator";
import { PrismaClient } from "@prisma/client";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const prisma = new PrismaClient();

// GET /albums
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const albums = await prisma.album.findMany({
      where: { userId: req.userId! },
      include: { _count: { select: { files: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ albums });
  })
);

// POST /albums — create a new album
router.post(
  "/",
  requireAuth,
  body("name").isString().trim().isLength({ min: 1, max: 100 }),
  asyncHandler(async (req, res) => {
    const album = await prisma.album.create({
      data: { userId: req.userId!, name: req.body.name },
    });
    res.status(201).json({ album });
  })
);

// GET /albums/:id — album detail with files
router.get(
  "/:id",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const album = await prisma.album.findFirst({
      where: { id: req.params.id, userId: req.userId! },
      include: { files: { include: { file: true }, orderBy: { addedAt: "desc" } } },
    });
    if (!album) throw new ApiError(404, "Album not found");
    res.json({ album });
  })
);

// POST /albums/:id/files — add file(s) to album (virtual link only)
router.post(
  "/:id/files",
  requireAuth,
  param("id").isString(),
  body("fileIds").isArray({ min: 1 }),
  asyncHandler(async (req, res) => {
    const album = await prisma.album.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!album) throw new ApiError(404, "Album not found");

    const fileIds: string[] = req.body.fileIds;
    const ownedFiles = await prisma.file.findMany({
      where: { id: { in: fileIds }, userId: req.userId! },
      select: { id: true },
    });
    if (ownedFiles.length !== fileIds.length) {
      throw new ApiError(400, "One or more files were not found or do not belong to this account");
    }

    // `skipDuplicates` on createMany is not supported by SQLite (only Postgres/MySQL),
    // so we filter out files already linked to this album ourselves instead.
    const alreadyLinked = await prisma.albumFile.findMany({
      where: { albumId: album.id, fileId: { in: fileIds } },
      select: { fileId: true },
    });
    const alreadyLinkedIds = new Set(alreadyLinked.map((a) => a.fileId));
    const newFileIds = fileIds.filter((id) => !alreadyLinkedIds.has(id));

    if (newFileIds.length > 0) {
      await prisma.albumFile.createMany({
        data: newFileIds.map((fileId) => ({ albumId: album.id, fileId })),
      });
    }

    res.json({ success: true });
  })
);

// DELETE /albums/:id/files/:fileId — remove file from album (does not delete the file)
router.delete(
  "/:id/files/:fileId",
  requireAuth,
  param("id").isString(),
  param("fileId").isString(),
  asyncHandler(async (req, res) => {
    const album = await prisma.album.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!album) throw new ApiError(404, "Album not found");
    await prisma.albumFile.deleteMany({ where: { albumId: album.id, fileId: req.params.fileId } });
    res.json({ success: true });
  })
);

// DELETE /albums/:id — delete the album itself (files are untouched)
router.delete(
  "/:id",
  requireAuth,
  param("id").isString(),
  asyncHandler(async (req, res) => {
    const album = await prisma.album.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!album) throw new ApiError(404, "Album not found");
    await prisma.album.delete({ where: { id: album.id } });
    res.json({ success: true });
  })
);

export default router;
