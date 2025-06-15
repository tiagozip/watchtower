import db from "../utils/db.js";
import { CONFIG } from "./config.js";

const whitelistCache = new Map();

const listWhitelistedQuery = db.prepare(
  `SELECT * FROM whitelists WHERE guild = $guild`
);

async function getWhitelists(guildId) {
  const now = Date.now();
  const cachedEntry = whitelistCache.get(guildId);

  if (
    cachedEntry &&
    now - cachedEntry.timestamp < CONFIG.CACHE.WHITELIST_TTL_MS
  ) {
    return cachedEntry.data;
  }

  const whitelists = await listWhitelistedQuery.all({ guild: guildId });
  whitelistCache.set(guildId, {
    data: whitelists,
    timestamp: now,
  });

  return whitelists;
}

export async function isWhitelisted(message) {
  const guildId = message.guildId;
  const whitelists = await getWhitelists(guildId);

  if (
    whitelists.some(
      (entry) => entry.type === "user" && entry.snowflake === message.author.id
    )
  ) {
    return true;
  }

  if (
    whitelists.some(
      (entry) =>
        entry.type === "channel" && entry.snowflake === message.channelId
    )
  ) {
    return true;
  }

  if (
    message.member?.roles.cache.some((role) =>
      whitelists.some(
        (entry) => entry.type === "role" && entry.snowflake === role.id
      )
    )
  ) {
    return true;
  }

  return false;
}
