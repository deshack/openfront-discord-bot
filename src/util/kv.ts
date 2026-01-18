export interface GuildConfig {
  clanTag: string;
  channelId: string;
}

const CONFIG_PREFIX = "config:";
const POSTED_PREFIX = "posted:";
const POSTED_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function getGuildConfig(
  kv: KVNamespace,
  guildId: string,
): Promise<GuildConfig | null> {
  const key = `${CONFIG_PREFIX}${guildId}`;
  return await kv.get<GuildConfig>(key, "json");
}

export async function setGuildConfig(
  kv: KVNamespace,
  guildId: string,
  config: GuildConfig,
): Promise<void> {
  const key = `${CONFIG_PREFIX}${guildId}`;
  await kv.put(key, JSON.stringify(config));
}

export async function deleteGuildConfig(
  kv: KVNamespace,
  guildId: string,
): Promise<void> {
  const key = `${CONFIG_PREFIX}${guildId}`;
  await kv.delete(key);
}

export async function listGuildConfigs(
  kv: KVNamespace,
): Promise<{ guildId: string; config: GuildConfig }[]> {
  const list = await kv.list({ prefix: CONFIG_PREFIX });
  const results: { guildId: string; config: GuildConfig }[] = [];

  for (const key of list.keys) {
    const config = await kv.get<GuildConfig>(key.name, "json");
    if (config) {
      const guildId = key.name.slice(CONFIG_PREFIX.length);
      results.push({ guildId, config });
    }
  }

  return results;
}

export async function isGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<boolean> {
  const key = `${POSTED_PREFIX}${guildId}:${gameId}`;
  const value = await kv.get(key);
  return value !== null;
}

export async function markGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<void> {
  const key = `${POSTED_PREFIX}${guildId}:${gameId}`;
  await kv.put(key, String(Date.now()), { expirationTtl: POSTED_TTL_SECONDS });
}
