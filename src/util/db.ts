export interface GuildConfig {
  clanTag: string;
  channelId: string;
}

interface GuildConfigRow {
  guild_id: string;
  clan_tag: string;
  channel_id: string;
  created_at: number;
  updated_at: number;
}

export async function getGuildConfig(
  db: D1Database,
  guildId: string,
): Promise<GuildConfig | null> {
  const row = await db
    .prepare("SELECT clan_tag, channel_id FROM guild_configs WHERE guild_id = ?")
    .bind(guildId)
    .first<GuildConfigRow>();

  if (!row) {
    return null;
  }

  return {
    clanTag: row.clan_tag,
    channelId: row.channel_id,
  };
}

export async function setGuildConfig(
  db: D1Database,
  guildId: string,
  config: GuildConfig,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO guild_configs (guild_id, clan_tag, channel_id, created_at, updated_at)
       VALUES (?, ?, ?, unixepoch(), unixepoch())
       ON CONFLICT (guild_id) DO UPDATE SET
         clan_tag = excluded.clan_tag,
         channel_id = excluded.channel_id,
         updated_at = unixepoch()`,
    )
    .bind(guildId, config.clanTag, config.channelId)
    .run();
}

export async function deleteGuildConfig(
  db: D1Database,
  guildId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM guild_configs WHERE guild_id = ?")
    .bind(guildId)
    .run();
}

export async function listGuildConfigs(
  db: D1Database,
): Promise<{ guildId: string; config: GuildConfig }[]> {
  const { results } = await db
    .prepare("SELECT guild_id, clan_tag, channel_id FROM guild_configs")
    .all<GuildConfigRow>();

  return results.map((row) => ({
    guildId: row.guild_id,
    config: {
      clanTag: row.clan_tag,
      channelId: row.channel_id,
    },
  }));
}
