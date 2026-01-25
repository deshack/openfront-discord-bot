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

// ========== Player Registrations ==========

export interface PlayerRegistration {
  channelId: string;
  discordUserId: string;
  playerId: string;
}

interface PlayerRegistrationRow {
  id: number;
  guild_id: string;
  channel_id: string;
  discord_user_id: string;
  player_id: string;
  created_at: number;
}

export async function registerPlayer(
  db: D1Database,
  guildId: string,
  channelId: string,
  discordUserId: string,
  playerId: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO player_registrations (guild_id, channel_id, discord_user_id, player_id, created_at)
       VALUES (?, ?, ?, ?, unixepoch())
       ON CONFLICT (guild_id, discord_user_id) DO UPDATE SET
         channel_id = excluded.channel_id,
         player_id = excluded.player_id`,
    )
    .bind(guildId, channelId, discordUserId, playerId)
    .run();
}

export async function unregisterPlayer(
  db: D1Database,
  guildId: string,
  discordUserId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "DELETE FROM player_registrations WHERE guild_id = ? AND discord_user_id = ?",
    )
    .bind(guildId, discordUserId)
    .run();

  return result.meta.changes > 0;
}

export async function getPlayerRegistration(
  db: D1Database,
  guildId: string,
  discordUserId: string,
): Promise<PlayerRegistration | null> {
  const row = await db
    .prepare(
      "SELECT channel_id, discord_user_id, player_id FROM player_registrations WHERE guild_id = ? AND discord_user_id = ?",
    )
    .bind(guildId, discordUserId)
    .first<PlayerRegistrationRow>();

  if (!row) {
    return null;
  }

  return {
    channelId: row.channel_id,
    discordUserId: row.discord_user_id,
    playerId: row.player_id,
  };
}

export async function listPlayerRegistrationsByGuild(
  db: D1Database,
  guildId: string,
): Promise<PlayerRegistration[]> {
  const { results } = await db
    .prepare(
      "SELECT channel_id, discord_user_id, player_id FROM player_registrations WHERE guild_id = ?",
    )
    .bind(guildId)
    .all<PlayerRegistrationRow>();

  return results.map((row) => ({
    channelId: row.channel_id,
    discordUserId: row.discord_user_id,
    playerId: row.player_id,
  }));
}

export async function listAllPlayerRegistrations(
  db: D1Database,
): Promise<{ guildId: string; registrations: PlayerRegistration[] }[]> {
  const { results } = await db
    .prepare(
      "SELECT guild_id, channel_id, discord_user_id, player_id FROM player_registrations ORDER BY guild_id",
    )
    .all<PlayerRegistrationRow>();

  const grouped = new Map<string, PlayerRegistration[]>();

  for (const row of results) {
    const existing = grouped.get(row.guild_id) ?? [];
    existing.push({
      channelId: row.channel_id,
      discordUserId: row.discord_user_id,
      playerId: row.player_id,
    });
    grouped.set(row.guild_id, existing);
  }

  return Array.from(grouped.entries()).map(([guildId, registrations]) => ({
    guildId,
    registrations,
  }));
}
