import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Logger, LogLevel } from "telegram/extensions/Logger";
import { env } from "../config/env";
import { decrypt } from "../utils/crypto";

/**
 * Builds a connected, already-authorized TelegramClient from a user's encrypted
 * session string. Callers MUST call client.disconnect() when finished — we do not
 * pool connections in this reference implementation. For production traffic,
 * consider a small LRU pool of connected clients keyed by userId with idle eviction.
 */
export async function getClientForUser(encryptedSession: string): Promise<TelegramClient> {
  const sessionString = decrypt(encryptedSession);
  const client = new TelegramClient(new StringSession(sessionString), env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
    connectionRetries: 3,
    // Each of these short-lived, single-request clients opens its own background
    // "live updates" loop internally, which is irrelevant for us (we only ever read/
    // send one-off messages) and otherwise logs noisy TIMEOUT retries. Raising the
    // log threshold keeps the terminal focused on real request errors.
    baseLogger: new Logger(LogLevel.ERROR),
  });
  await client.connect();
  return client;
}

export async function withUserClient<T>(
  encryptedSession: string,
  fn: (client: TelegramClient) => Promise<T>
): Promise<T> {
  const client = await getClientForUser(encryptedSession);
  try {
    return await fn(client);
  } finally {
    await client.disconnect().catch(() => {});
  }
}
