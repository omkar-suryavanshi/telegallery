import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "4000", 10),

  // From https://my.telegram.org — required for MTProto client use.
  TELEGRAM_API_ID: parseInt(required("TELEGRAM_API_ID"), 10),
  TELEGRAM_API_HASH: required("TELEGRAM_API_HASH"),

  DATABASE_URL: required("DATABASE_URL"),

  // 32-byte (64 hex char) key used to AES-256-GCM encrypt Telegram sessions at rest.
  SESSION_ENCRYPTION_KEY: required("SESSION_ENCRYPTION_KEY"),

  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "30d",

  COOKIE_NAME: process.env.COOKIE_NAME ?? "telegallery_session",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",

  UPLOAD_TMP_DIR: process.env.UPLOAD_TMP_DIR ?? "/tmp/telegallery-uploads",
  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "500", 10),

  STORAGE_CHANNEL_TITLE: process.env.STORAGE_CHANNEL_TITLE ?? "TeleGallery Storage",
};
