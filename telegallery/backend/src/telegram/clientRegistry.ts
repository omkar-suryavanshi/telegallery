import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Logger, LogLevel } from "telegram/extensions/Logger";
import { v4 as uuid } from "uuid";
import { env } from "../config/env";

/**
 * A login flow with GramJS spans several HTTP requests (send code -> verify code ->
 * maybe verify 2FA password). MTProto requires the SAME client/connection to be reused
 * across those steps, so we hold pending, not-yet-authorized clients in memory keyed by
 * a short-lived loginToken. Each entry is torn down on success, failure, or timeout.
 *
 * For a multi-instance deployment, replace this with a sticky-session load balancer
 * (pending logins are short-lived, ~2 minutes) or a Redis-backed lock that pins a login
 * flow to one backend instance.
 */
interface PendingLogin {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  createdAt: number;
}

const PENDING_TTL_MS = 5 * 60 * 1000;
const pending = new Map<string, PendingLogin>();

// Periodically sweep expired/abandoned login attempts so we don't leak MTProto connections.
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pending.entries()) {
    if (now - entry.createdAt > PENDING_TTL_MS) {
      entry.client.disconnect().catch(() => {});
      pending.delete(token);
    }
  }
}, 60_000).unref();

export function createPendingClient(): TelegramClient {
  return new TelegramClient(new StringSession(""), env.TELEGRAM_API_ID, env.TELEGRAM_API_HASH, {
    connectionRetries: 3,
    baseLogger: new Logger(LogLevel.ERROR),
  });
}

export function registerPendingLogin(client: TelegramClient, phone: string, phoneCodeHash: string): string {
  const token = uuid();
  pending.set(token, { client, phone, phoneCodeHash, createdAt: Date.now() });
  return token;
}

export function getPendingLogin(token: string): PendingLogin | undefined {
  return pending.get(token);
}

export function discardPendingLogin(token: string) {
  const entry = pending.get(token);
  if (entry) {
    entry.client.disconnect().catch(() => {});
    pending.delete(token);
  }
}

/**
 * Removes login bookkeeping WITHOUT disconnecting the client — used when a login
 * just succeeded and the caller still needs the live, authenticated client (e.g. to
 * immediately provision the storage channel) before disconnecting it themselves.
 */
export function detachPendingLogin(token: string): TelegramClient | undefined {
  const entry = pending.get(token);
  if (!entry) return undefined;
  pending.delete(token);
  return entry.client;
}
