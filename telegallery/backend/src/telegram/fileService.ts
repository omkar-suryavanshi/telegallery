import fs from "fs";
import { TelegramClient } from "telegram";
import { CustomFile } from "telegram/client/uploads";
import { PrismaClient } from "@prisma/client";
import { extractMediaMeta, generateThumbnail } from "../utils/mediaMeta";
import { sha256Hex } from "../utils/crypto";
import { buildChannelPeer } from "./channelService";

const prisma = new PrismaClient();

export interface UploadInput {
  userId: string;
  channelId: string;
  channelAccessHash: string;
  localFilePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadFileToTelegram(client: TelegramClient, input: UploadInput) {
  const buffer = fs.readFileSync(input.localFilePath);
  const sha256 = sha256Hex(buffer);

  // Duplicate detection: same user, same content hash, not trashed.
  const duplicate = await prisma.file.findFirst({
    where: { userId: input.userId, sha256, isTrashed: false },
  });
  if (duplicate) {
    return { duplicate: true, file: duplicate };
  }

  const meta = await extractMediaMeta(input.localFilePath, input.mimeType);
  const channelPeer = buildChannelPeer(input.channelId, input.channelAccessHash);

  const toUpload = new CustomFile(input.originalName, input.sizeBytes, input.localFilePath);
  const message = await client.sendFile(channelPeer, {
    file: toUpload,
    caption: input.originalName,
    forceDocument: meta.kind === "DOCUMENT",
  });

  let thumbnailMessageId: number | undefined;
  const thumbBuffer = await generateThumbnail(input.localFilePath);
  if (thumbBuffer) {
    const thumbFile = new CustomFile(`thumb_${input.originalName}.jpg`, thumbBuffer.length, "", thumbBuffer);
    const thumbMessage = await client.sendFile(channelPeer, {
      file: thumbFile,
      forceDocument: false,
    });
    thumbnailMessageId = thumbMessage.id;
  }

  const file = await prisma.file.create({
    data: {
      userId: input.userId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      kind: meta.kind,
      sizeBytes: input.sizeBytes,
      sha256,
      width: meta.width,
      height: meta.height,
      durationMs: meta.durationMs,
      telegramMessageId: message.id,
      telegramChannelId: input.channelId,
      thumbnailMessageId,
    },
  });

  return { duplicate: false, file };
}

/** Downloads the original file bytes for a given DB file record. */
export async function downloadFileBytes(
  client: TelegramClient,
  channelId: string,
  channelAccessHash: string,
  messageId: number
) {
  const channelPeer = buildChannelPeer(channelId, channelAccessHash);
  const messages = await client.getMessages(channelPeer, { ids: [messageId] });
  const message = messages[0];
  if (!message) throw new Error("Original message not found in storage channel");
  const buffer = await client.downloadMedia(message, {});
  return buffer as Buffer;
}
