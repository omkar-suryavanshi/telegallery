import { Api, TelegramClient } from "telegram";
import bigInt from "big-integer";
import { env } from "../config/env";

export interface StorageChannel {
  channelId: string;
  accessHash: string;
}

/**
 * Looks for an existing dialog whose title matches STORAGE_CHANNEL_TITLE. If found,
 * returns its id + access hash. Otherwise creates a new private broadcast channel
 * (visible only to the user, no public username) and returns the new one's id + hash.
 *
 * We re-check by title on every login rather than trusting only the DB's cached
 * channelId, in case the user deleted or renamed the channel from within Telegram itself.
 *
 * IMPORTANT: we return the accessHash and persist it (see routes/auth.ts) because MTProto
 * requires both the id AND access hash to address a channel. GramJS/Telethon normally
 * resolve the access hash from an in-memory "entity cache" built up as you use a client —
 * but that cache is NOT persisted by StringSession, so a fresh client reconnected from a
 * saved session string has an empty cache and calling client.getEntity(bareId) on it fails
 * with "Cannot find any entity". Storing the hash ourselves and building an explicit
 * Api.InputPeerChannel (see buildChannelPeer below) sidesteps that entirely.
 */
export async function getOrCreateStorageChannel(client: TelegramClient): Promise<StorageChannel> {
  const dialogs = await client.getDialogs({ limit: 100 });
  const existing = dialogs.find((d) => d.isChannel && d.title === env.STORAGE_CHANNEL_TITLE);
  if (existing?.entity) {
    const channel = existing.entity as Api.Channel;
    return { channelId: String(channel.id), accessHash: String(channel.accessHash) };
  }

  const created = await client.invoke(
    new Api.channels.CreateChannel({
      title: env.STORAGE_CHANNEL_TITLE,
      about: "Private storage channel managed by TeleGallery. Do not delete or rename.",
      megagroup: false,
      broadcast: true,
    })
  );

  // CreateChannel returns Updates; pull the new channel out of the chats list.
  const chats = (created as any).chats as Api.Channel[];
  const channel = chats.find((c) => c.title === env.STORAGE_CHANNEL_TITLE) ?? chats[0];
  if (!channel) throw new Error("Telegram did not return the newly created channel");

  return { channelId: String(channel.id), accessHash: String(channel.accessHash) };
}

/**
 * Builds a reference to the storage channel directly from its stored id + access hash,
 * without any network lookup or dependence on the client's entity cache. Safe to pass
 * to client.sendFile / getMessages / downloadMedia / deleteMessages.
 */
export function buildChannelPeer(channelId: string, accessHash: string): Api.InputPeerChannel {
  return new Api.InputPeerChannel({
    channelId: bigInt(channelId),
    accessHash: bigInt(accessHash),
  });
}
