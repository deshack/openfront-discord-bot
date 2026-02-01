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
    .prepare(
      "SELECT clan_tag, channel_id FROM guild_configs WHERE guild_id = ?",
    )
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

export type ScanJobStatus = "pending" | "processing" | "completed" | "failed";

export type ScanJobType = "clan" | "players";

export interface ScanJob {
  id: number;
  guildId: string;
  channelId: string;
  clanTag: string | null;
  status: ScanJobStatus;
  jobType: ScanJobType;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
}

interface ScanJobRow {
  id: number;
  guild_id: string;
  channel_id: string;
  clan_tag: string | null;
  status: string;
  job_type: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  error_message: string | null;
}

function rowToScanJob(row: ScanJobRow): ScanJob {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    clanTag: row.clan_tag,
    status: row.status as ScanJobStatus,
    jobType: row.job_type as ScanJobType,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}

export interface ScanJobClanSession {
  scanJobId: number;
  gameId: string;
  status: ScanJobStatus;
  score: number;
  errorMessage: string | null;
}

export interface ScanJobClanSessionRow {
  scan_job_id: number;
  game_id: string;
  status: string;
  score: number;
  error_message: string | null;
}

function rowToScanJobClanSession(
  row: ScanJobClanSessionRow,
): ScanJobClanSession {
  return {
    scanJobId: row.scan_job_id,
    gameId: row.game_id,
    status: row.status as ScanJobStatus,
    score: row.score,
    errorMessage: row.error_message,
  };
}

export async function createScanJob(
  db: D1Database,
  guildId: string,
  channelId: string,
  clanTag: string | null,
  jobType: ScanJobType,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO scan_jobs (guild_id, channel_id, clan_tag, job_type)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(guildId, channelId, clanTag, jobType)
    .run();

  return result.meta.last_row_id as number;
}

export async function createScanJobClanSession(
  db: D1Database,
  scanJobId: number,
  gameId: string,
  score: number,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO scan_job_clan_sessions (scan_job_id, game_id, score) VALUES (?, ?, ?)`,
    )
    .bind(scanJobId, gameId, score)
    .run();

  return result.meta.last_row_id as number;
}
const STALE_THRESHOLD_SECONDS = 300;

/**
 * Atomically claims the next scan job for processing.
 * This prevents race conditions where multiple workers could claim the same job.
 *
 * For 'pending' jobs: claims by setting started_at (WHERE started_at IS NULL or stale)
 * For 'processing_*' jobs: claims if the job appears stale (started_at > 5 min ago)
 *
 * @returns The claimed job, or null if no job is available or claim failed.
 */
export async function claimNextPendingJob(
  db: D1Database,
): Promise<ScanJob | null> {
  const pendingResult = await db
    .prepare(
      `UPDATE scan_jobs
       SET started_at = unixepoch()
       WHERE id = (
         SELECT id FROM scan_jobs
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT 1
       ) AND status = 'pending'
       RETURNING *`,
    )
    .bind(STALE_THRESHOLD_SECONDS)
    .first<ScanJobRow>();

  if (pendingResult) {
    return rowToScanJob(pendingResult);
  }

  const processingResult = await db
    .prepare(
      `SELECT * FROM scan_jobs
       WHERE status = 'processing'
         OR (unixepoch() - COALESCE(started_at, 0)) > ?
       ORDER BY created_at ASC
         LIMIT 1`,
    )
    .bind(STALE_THRESHOLD_SECONDS)
    .first<ScanJobRow>();

  if (processingResult) {
    return rowToScanJob(processingResult);
  }

  return null;
}

export async function getClanSessionsJobBatch(
  db: D1Database,
  jobId: number,
): Promise<ScanJobClanSession[]> {
  const pendingResult = await db
    .prepare(
      `UPDATE scan_job_clan_sessions
       SET status = 'processing', started_at = unixepoch()
       WHERE id IN (
         SELECT id FROM scan_job_clan_sessions
         WHERE job_id = ?
           AND (status = 'pending'
           OR (unixepoch() - COALESCE(started_at, 0)) > ?)
         ORDER BY game_id ASC
         LIMIT 50
       ) AND job_id = ?
       AND (status = 'pending' OR (unixepoch() - COALESCE(started_at, 0)) > ?)
       RETURNING *`,
    )
    .bind(jobId, STALE_THRESHOLD_SECONDS)
    .run<ScanJobClanSessionRow>();

  return pendingResult.results.map(rowToScanJobClanSession);
}

export async function completeClanSessionJob(
  db: D1Database,
  jobId: number,
  gameId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE scan_job_clan_sessions SET status = ?, completed_at = unixepoch() WHERE job_id = ? AND game_id = ?`,
    )
    .bind("completed", jobId, gameId)
    .run();
}

export async function countPendingClanSessionJobs(
  db: D1Database,
  jobId: number,
): Promise<number | null> {
  return await db
    .prepare(
      `SELECT COUNT(*) FROM scan_job_clan_sessions WHERE job_id = ? and status IN ('pending', 'processing')`,
    )
    .bind(jobId)
    .first<number>();
}
export async function completeScanJob(
  db: D1Database,
  jobId: number,
): Promise<void> {
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
