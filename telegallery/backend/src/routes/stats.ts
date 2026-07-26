import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { FileKind } from "../types/fileKind";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const prisma = new PrismaClient();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalFiles, byKind, totalSizeAgg, uploadsThisMonth, largestFiles, recentUploads] = await Promise.all([
      prisma.file.count({ where: { userId, isTrashed: false } }),
      prisma.file.groupBy({
        by: ["kind"],
        where: { userId, isTrashed: false },
        _count: { _all: true },
      }),
      prisma.file.aggregate({
        where: { userId, isTrashed: false },
        _sum: { sizeBytes: true },
      }),
      prisma.file.count({ where: { userId, isTrashed: false, uploadedAt: { gte: startOfMonth } } }),
      prisma.file.findMany({
        where: { userId, isTrashed: false },
        orderBy: { sizeBytes: "desc" },
        take: 10,
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false },
        orderBy: { uploadedAt: "desc" },
        take: 10,
      }),
    ]);

    const kindCounts: Record<string, number> = {};
    for (const k of Object.values(FileKind)) kindCounts[k] = 0;
    for (const row of byKind) kindCounts[row.kind] = row._count._all;

    res.json({
      totalFiles,
      totalStorageBytes: totalSizeAgg._sum.sizeBytes ?? 0,
      byKind: kindCounts,
      uploadsThisMonth,
      largestFiles,
      recentUploads,
    });
  })
);

export default router;
