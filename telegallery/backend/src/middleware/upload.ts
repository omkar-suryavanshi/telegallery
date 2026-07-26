import fs from "fs";
import multer from "multer";
import path from "path";
import { v4 as uuid } from "uuid";
import { env } from "../config/env";

if (!fs.existsSync(env.UPLOAD_TMP_DIR)) {
  fs.mkdirSync(env.UPLOAD_TMP_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_TMP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
});
