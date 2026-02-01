import { GameMode } from "./api_schemas";

export type LeaderboardPeriod = "monthly" | "all_time";

export interface MonthContext {
  year: number;
  month: number;
}

export interface LeaderboardEntry {
  username: string;
  wins: number;
  totalScore: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  totalCount: number;
}

export interface PlayerRank {
  rank: number;
  wins: number;
  totalScore: number;
}

interface LeaderboardRow {
  username: string;
  wins: number;
  total_score: number;
}

interface CountRow {
  count: number;
}

export function getMonthTimestampRange(context?: MonthContext): { start: number; end: number } {
  const now = new Date();
  const year = context?.year ?? now.getUTCFullYear();
  const month = context?.month ?? now.getUTCMonth() + 1;

  const startOfMonth = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = Date.UTC(year, month, 1, 0, 0, 0, 0);

  return {
    start: Math.floor(startOfMonth / 1000),
    end: Math.floor(endOfMonth / 1000),
  };
}

export function isCurrentMonth(context?: MonthContext): boolean {
  if (!context) {
    return true;
  }

  const now = new Date();

  return context.year === now.getUTCFullYear() && context.month === now.getUTCMonth() + 1;
}

export function getEndOfMonth(context?: MonthContext): Date {
  const now = new Date();
  const year = context?.year ?? now.getUTCFullYear();
  const month = context?.month ?? now.getUTCMonth() + 1;

  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

export async function recordPlayerWin(
  db: D1Database,
  guildId: string,
  username: string,
  gameId: string,
  gameMode: GameMode,
  score: number,
  gameStart: string,
): Promise<void> {
  const gameStartTimestamp = Math.floor(new Date(gameStart).getTime() / 1000);

  await db
    .prepare(
      `INSERT INTO player_stats (guild_id, username, game_id, game_type, score, game_start)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, username, game_id) DO NOTHING`,
    )
    .bind(guildId, username, gameId, gameMode, score, gameStartTimestamp)
    .run();
}

export async function getLeaderboard(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  limit: number,
  offset: number,
  monthContext?: MonthContext,
): Promise<LeaderboardResult> {
  if (period === "all_time") {
    const countResult = await db
      .prepare(
        `SELECT COUNT(DISTINCT username) as count
         FROM player_stats
         WHERE guild_id = ?`,
      )
      .bind(guildId)
      .first<CountRow>();

    const totalCount = countResult?.count ?? 0;

    const { results } = await db
      .prepare(
        `SELECT
           username,
           COUNT(*) as wins,
           SUM(score) as total_score
         FROM player_stats
         WHERE guild_id = ?
         GROUP BY guild_id, username
         ORDER BY wins DESC, total_score DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(guildId, limit, offset)
      .all<LeaderboardRow>();

    return {
      entries: results.map((row) => ({
        username: row.username,
        wins: row.wins,
        totalScore: row.total_score,
      })),
      totalCount,
    };
  }

  const { start, end } = getMonthTimestampRange(monthContext);
  const isPastMonth = !isCurrentMonth(monthContext);

  const countResult = await db
    .prepare(
      isPastMonth
        ? `SELECT COUNT(DISTINCT username) as count
           FROM player_stats
           WHERE guild_id = ?
             AND game_start >= ?
             AND game_start < ?`
        : `SELECT COUNT(DISTINCT username) as count
           FROM player_stats
           WHERE guild_id = ?
             AND game_start >= ?`,
    )
    .bind(...(isPastMonth ? [guildId, start, end] : [guildId, start]))
    .first<CountRow>();

  const totalCount = countResult?.count ?? 0;

  const { results } = await db
    .prepare(
      isPastMonth
        ? `SELECT
             username,
             COUNT(*) as wins,
             SUM(score) as total_score
           FROM player_stats
           WHERE guild_id = ?
             AND game_start >= ?
             AND game_start < ?
           GROUP BY guild_id, username
           ORDER BY wins DESC, total_score DESC
           LIMIT ? OFFSET ?`
        : `SELECT
             username,
             COUNT(*) as wins,
             SUM(score) as total_score
           FROM player_stats
           WHERE guild_id = ?
             AND game_start >= ?
           GROUP BY guild_id, username
           ORDER BY wins DESC, total_score DESC
           LIMIT ? OFFSET ?`,
    )
    .bind(...(isPastMonth ? [guildId, start, end, limit, offset] : [guildId, start, limit, offset]))
    .all<LeaderboardRow>();

  return {
    entries: results.map((row) => ({
      username: row.username,
      wins: row.wins,
      totalScore: row.total_score,
    })),
    totalCount,
  };
}

export async function getPlayerRank(
  db: D1Database,
  guildId: string,
  username: string,
  period: LeaderboardPeriod,
): Promise<PlayerRank | null> {
  const startTimestamp = period === "monthly" ? getMonthTimestampRange().start : 0;

  const playerStats = await db
    .prepare(
      `SELECT
         COUNT(*) as wins,
         SUM(score) as total_score
       FROM player_stats
       WHERE guild_id = ?
         AND username = ?
         AND game_start >= ?`,
    )
    .bind(guildId, username, startTimestamp)
    .first<LeaderboardRow>();

  if (!playerStats || playerStats.wins === 0) {
    return null;
  }

  const rankResult = await db
    .prepare(
      `SELECT COUNT(*) + 1 as rank
       FROM (
         SELECT
           username,
           COUNT(*) as wins,
           SUM(score) as total_score
         FROM player_stats
         WHERE guild_id = ?
           AND game_start >= ?
         GROUP BY guild_id, username
       ) ranked
       WHERE wins > ?
          OR (wins = ? AND total_score > ?)`,
    )
    .bind(
      guildId,
      startTimestamp,
      playerStats.wins,
      playerStats.wins,
      playerStats.total_score,
    )
    .first<{ rank: number }>();

  return {
    rank: rankResult?.rank ?? 1,
    wins: playerStats.wins,
    totalScore: playerStats.total_score,
  };
}
