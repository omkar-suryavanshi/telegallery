import sharp from "sharp";
import { FileKind } from "../types/fileKind";

// fluent-ffmpeg / @ffmpeg-installer/ffmpeg are loaded lazily and defensively.
// On some Windows setups, @ffmpeg-installer's postinstall script can fail to place
// the ffmpeg.exe binary (a known npm/workspaces quirk), which would otherwise crash
// the entire server at startup via a top-level import. Instead, we attempt to load it
// once, remember whether it worked, and gracefully skip video/audio duration+resolution
// extraction if it didn't — every other feature keeps working.
let ffmpegModule: typeof import("fluent-ffmpeg") | null = null;
let ffmpegLoadAttempted = false;

function getFfmpeg(): typeof import("fluent-ffmpeg") | null {
  if (ffmpegLoadAttempted) return ffmpegModule;
  ffmpegLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpeg = require("fluent-ffmpeg");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegInstallerPath = require("@ffmpeg-installer/ffmpeg").path;
    ffmpeg.setFfmpegPath(ffmpegInstallerPath);
    ffmpegModule = ffmpeg;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[mediaMeta] ffmpeg is unavailable — video/audio duration and resolution will be skipped. " +
        "See README/troubleshooting for how to fix this. Underlying error:",
      (err as Error).message
    );
    ffmpegModule = null;
  }
  return ffmpegModule;
}

export interface MediaMeta {
  kind: FileKind;
  width?: number;
  height?: number;
  durationMs?: number;
}

export function classifyMime(mimeType: string): FileKind {
  if (mimeType.startsWith("image/")) return FileKind.PHOTO;
  if (mimeType.startsWith("video/")) return FileKind.VIDEO;
  if (mimeType.startsWith("audio/")) return FileKind.AUDIO;
  return FileKind.DOCUMENT;
}

export async function extractMediaMeta(filePath: string, mimeType: string): Promise<MediaMeta> {
  const kind = classifyMime(mimeType);

  if (kind === FileKind.PHOTO) {
    try {
      const meta = await sharp(filePath).metadata();
      return { kind, width: meta.width, height: meta.height };
    } catch {
      // Not all "image/*" mimetypes are decodable by sharp (e.g. some RAW formats) —
      // fall back to no dimensions rather than failing the whole upload.
      return { kind };
    }
  }

  if (kind === FileKind.VIDEO || kind === FileKind.AUDIO) {
    const ffmpeg = getFfmpeg();
    if (!ffmpeg) return { kind };
    try {
      const probe = await ffprobeAsync(ffmpeg, filePath);
      const videoStream = probe.streams.find((s) => s.codec_type === "video");
      return {
        kind,
        width: videoStream?.width,
        height: videoStream?.height,
        durationMs: probe.format.duration ? Math.round(probe.format.duration * 1000) : undefined,
      };
    } catch {
      return { kind };
    }
  }

  return { kind };
}

function ffprobeAsync(
  ffmpeg: typeof import("fluent-ffmpeg"),
  filePath: string
): Promise<import("fluent-ffmpeg").FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/** Generates a compressed JPEG thumbnail, returned as an in-memory buffer. */
export async function generateThumbnail(filePath: string, maxWidth = 500): Promise<Buffer | null> {
  try {
    return await sharp(filePath)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[mediaMeta] Thumbnail generation failed — the original file was still uploaded " +
        "successfully, but the gallery will show the full image instead of a thumbnail. " +
        "Underlying error:",
      (err as Error).message
    );
    return null;
  }
}
