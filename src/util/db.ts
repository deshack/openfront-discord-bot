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

// ========== Scan Jobs ==========

export type ScanJobStatus =
  | "pending"
  | "processing_clan"
  | "processing_ffa"
  | "completed"
  | "failed";

export interface ScanJob {
  id: number;
  guildId: string;
  channelId: string;
  clanTag: string | null;
  startDate: string;
  endDate: string;
  status: ScanJobStatus;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  clanGames: string[] | null;
  clanGamesProcessed: number;
  clanPlayersRecorded: number;
  ffaPlayerIds: string[] | null;
  ffaPlayerIndex: number;
  ffaWinsProcessed: number;
  errorMessage: string | null;
}

interface ScanJobRow {
  id: number;
  guild_id: string;
  channel_id: string;
  clan_tag: string | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  clan_games: string | null;
  clan_games_processed: number;
  clan_players_recorded: number;
  ffa_player_ids: string | null;
  ffa_player_index: number;
  ffa_wins_processed: number;
  error_message: string | null;
}

function rowToScanJob(row: ScanJobRow): ScanJob {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    clanTag: row.clan_tag,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as ScanJobStatus,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    clanGames: row.clan_games ? JSON.parse(row.clan_games) : null,
    clanGamesProcessed: row.clan_games_processed,
    clanPlayersRecorded: row.clan_players_recorded,
    ffaPlayerIds: row.ffa_player_ids ? JSON.parse(row.ffa_player_ids) : null,
    ffaPlayerIndex: row.ffa_player_index,
    ffaWinsProcessed: row.ffa_wins_processed,
    errorMessage: row.error_message,
  };
}

export async function createScanJob(
  db: D1Database,
  guildId: string,
  channelId: string,
  clanTag: string | null,
  startDate: string,
  endDate: string,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO scan_jobs (guild_id, channel_id, clan_tag, start_date, end_date)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(guildId, channelId, clanTag, startDate, endDate)
    .run();

  return result.meta.last_row_id as number;
}

export async function getActiveScanJobForGuild(
  db: D1Database,
  guildId: string,
): Promise<ScanJob | null> {
  const row = await db
    .prepare(
      `SELECT * FROM scan_jobs
       WHERE guild_id = ? AND status IN ('pending', 'processing_clan', 'processing_ffa')
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(guildId)
    .first<ScanJobRow>();

  if (!row) {
    return null;
  }

  return rowToScanJob(row);
}

export async function getNextPendingJob(db: D1Database): Promise<ScanJob | null> {
  const row = await db
    .prepare(
      `SELECT * FROM scan_jobs
       WHERE status IN ('pending', 'processing_clan', 'processing_ffa')
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .first<ScanJobRow>();

  if (!row) {
    return null;
  }

  return rowToScanJob(row);
}

export async function updateScanJobStatus(
  db: D1Database,
  jobId: number,
  status: ScanJobStatus,
): Promise<void> {
  if (status === "processing_clan") {
    await db
      .prepare(
        `UPDATE scan_jobs SET status = ?, started_at = unixepoch() WHERE id = ?`,
      )
      .bind(status, jobId)
      .run();
  } else {
    await db
      .prepare(`UPDATE scan_jobs SET status = ? WHERE id = ?`)
      .bind(status, jobId)
      .run();
  }
}

export async function initializeScanJobClanGames(
  db: D1Database,
  jobId: number,
  clanGames: string[],
): Promise<void> {
  await db
    .prepare(
      `UPDATE scan_jobs SET clan_games = ?, status = 'processing_clan', started_at = unixepoch() WHERE id = ?`,
    )
    .bind(JSON.stringify(clanGames), jobId)
    .run();
}

export async function initializeScanJobFFAPlayers(
  db: D1Database,
  jobId: number,
  ffaPlayerIds: string[],
): Promise<void> {
  await db
    .prepare(
      `UPDATE scan_jobs SET ffa_player_ids = ?, status = 'processing_ffa', started_at = unixepoch() WHERE id = ?`
    )
    .bind(JSON.stringify(ffaPlayerIds), jobId)
    .run();
}
}

export async function updateScanJobClanProgress(
  db: D1Database,
  jobId: number,
  gamesProcessed: number,
  playersRecorded: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE scan_jobs SET clan_games_processed = ?, clan_players_recorded = ? WHERE id = ?`,
    )
    .bind(gamesProcessed, playersRecorded, jobId)
    .run();
}

export async function updateScanJobFFAProgress(
  db: D1Database,
  jobId: number,
  playerIndex: number,
  winsProcessed: number,
): Promise<void> {
  await db
    .prepare(`UPDATE scan_jobs SET ffa_player_index = ?, ffa_wins_processed = ? WHERE id = ?`)
    .bind(playerIndex, winsProcessed, jobId)
    .run();
}

export async function completeScanJob(db: D1Database, jobId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE scan_jobs SET status = 'completed', completed_at = unixepoch() WHERE id = ?`,
    )
    .bind(jobId)
    .run();
}

export async function failScanJob(
  db: D1Database,
  jobId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE scan_jobs SET status = 'failed', completed_at = unixepoch(), error_message = ? WHERE id = ?`,
    )
    .bind(errorMessage, jobId)
    .run();
}
