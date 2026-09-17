import { GameMode } from "./api_schemas";

export type LeaderboardPeriod = "monthly" | "weekly" | "all_time";
export type RankingType = "wins" | "score" | "ffa_wins" | "team_wins";

export interface MonthContext {
  year: number;
  month: number;
}

export interface WeekContext {
  year: number;
  week: number; // ISO week number, 1–53
}

export interface LeaderboardEntry {
  username: string;
  wins: number;
  teamWins: number;
  ffaWins: number;
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
  team_wins: number;
  ffa_wins: number;
  total_score: number;
}

interface CountRow {
  count: number;
}

export function getMonthTimestampRange(context?: MonthContext): {
  start: number;
  end: number;
} {
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

  return (
    context.year === now.getUTCFullYear() &&
    context.month === now.getUTCMonth() + 1
  );
}

export function getEndOfMonth(context?: MonthContext): Date {
  const now = new Date();
  const year = context?.year ?? now.getUTCFullYear();
  const month = context?.month ?? now.getUTCMonth() + 1;

  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

function getMondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay();
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - ((dayOfWeek + 6) % 7));
  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

export function getWeekTimestampRange(context?: WeekContext): {
  start: number;
  end: number;
} {
  const { year, week } = context ?? getISOWeek(new Date());
  const monday = getMondayOfISOWeek(year, week);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  return {
    start: Math.floor(monday.getTime() / 1000),
    end: Math.floor(nextMonday.getTime() / 1000),
  };
}

export function isCurrentWeek(context?: WeekContext): boolean {
  if (!context) {
    return true;
  }
  const current = getISOWeek(new Date());
  return context.year === current.year && context.week === current.week;
}

export async function recordPlayerWin(
  db: D1Database,
  guildId: string,
  username: string,
  gameId: string,
  gameMode: GameMode,
  score: number,
  gameStart: string,
  publicId?: string | null,
): Promise<void> {
  const gameStartTimestamp = Math.floor(new Date(gameStart).getTime() / 1000);

  await db
    .prepare(
      `INSERT INTO player_stats (guild_id, username, game_id, game_type, score, game_start, public_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, username, game_id) DO UPDATE SET
         public_id = excluded.public_id`,
    )
    .bind(guildId, username, gameId, gameMode, score, gameStartTimestamp, publicId ?? null)
    .run();
}

export async function deletePlayerWinsByGame(
  db: D1Database,
  guildId: string,
  gameId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM player_stats WHERE guild_id = ? AND game_id = ?")
    .bind(guildId, gameId)
    .run();
}

interface TimeRange {
  start: number;
  end?: number;
}

/**
 * Players are grouped by public_id when known (backfilled or recorded via
 * /register), falling back to username for legacy rows that predate it.
 * The most recently seen username for that identity is shown.
 */
async function queryLeaderboard(
  db: D1Database,
  guildId: string,
  limit: number,
  offset: number,
  orderBy: string,
  timeRange?: TimeRange,
): Promise<LeaderboardResult> {
  const timeClause =
    timeRange === undefined
      ? ""
      : timeRange.end === undefined
        ? "AND game_start >= ?"
        : "AND game_start >= ? AND game_start < ?";
  const timeParams =
    timeRange === undefined
      ? []
      : timeRange.end === undefined
        ? [timeRange.start]
        : [timeRange.start, timeRange.end];

  const countResult = await db
    .prepare(
      `SELECT COUNT(DISTINCT COALESCE(public_id, username)) as count
       FROM player_stats
       WHERE guild_id = ? ${timeClause}`,
    )
    .bind(guildId, ...timeParams)
    .first<CountRow>();

  const totalCount = countResult?.count ?? 0;

  const { results } = await db
    .prepare(
      `WITH scoped AS (
         SELECT *, COALESCE(public_id, username) AS identity
         FROM player_stats
         WHERE guild_id = ? ${timeClause}
       ),
       latest_username AS (
         SELECT identity, username,
           ROW_NUMBER() OVER (PARTITION BY identity ORDER BY game_start DESC) as rn
         FROM scoped
       )
       SELECT
         lu.username as username,
         COUNT(*) as wins,
         SUM(CASE WHEN s.game_type = 'Team' THEN 1 ELSE 0 END) as team_wins,
         SUM(CASE WHEN s.game_type = 'Free For All' THEN 1 ELSE 0 END) as ffa_wins,
         SUM(s.score) as total_score
       FROM scoped s
       JOIN latest_username lu ON lu.identity = s.identity AND lu.rn = 1
       GROUP BY s.identity
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .bind(guildId, ...timeParams, limit, offset)
    .all<LeaderboardRow>();

  return {
    entries: results.map((row) => ({
      username: row.username,
      wins: row.wins,
      teamWins: row.team_wins,
      ffaWins: row.ffa_wins,
      totalScore: row.total_score,
    })),
    totalCount,
  };
}

export async function getLeaderboard(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  limit: number,
  offset: number,
  monthContext?: MonthContext,
  rankingType: RankingType = "wins",
  weekContext?: WeekContext,
): Promise<LeaderboardResult> {
  const orderBy =
    rankingType === "score"
      ? "total_score DESC, wins DESC"
      : rankingType === "ffa_wins"
        ? "ffa_wins DESC, wins DESC"
        : rankingType === "team_wins"
          ? "team_wins DESC, wins DESC"
          : "wins DESC, total_score DESC";

  if (period === "all_time") {
    return queryLeaderboard(db, guildId, limit, offset, orderBy);
  }

  if (period === "weekly") {
    const { start, end } = getWeekTimestampRange(weekContext);
    const timeRange = isCurrentWeek(weekContext) ? { start } : { start, end };

    return queryLeaderboard(db, guildId, limit, offset, orderBy, timeRange);
  }

  const { start, end } = getMonthTimestampRange(monthContext);
  const timeRange = isCurrentMonth(monthContext) ? { start } : { start, end };

  return queryLeaderboard(db, guildId, limit, offset, orderBy, timeRange);
}

export interface PlayerIdentity {
  username: string;
  publicId?: string | null;
}

export async function getPlayerRank(
  db: D1Database,
  guildId: string,
  identity: PlayerIdentity,
  period: LeaderboardPeriod,
): Promise<PlayerRank | null> {
  const startTimestamp =
    period === "monthly" ? getMonthTimestampRange().start : 0;

  const playerStats = await db
    .prepare(
      `SELECT
         COUNT(*) as wins,
         SUM(score) as total_score
       FROM player_stats
       WHERE guild_id = ?
         AND COALESCE(public_id, username) = ?
         AND game_start >= ?`,
    )
    .bind(
      guildId,
      identity.publicId ?? identity.username,
      startTimestamp,
    )
    .first<LeaderboardRow>();

  if (!playerStats || playerStats.wins === 0) {
    return null;
  }

  const rankResult = await db
    .prepare(
      `SELECT COUNT(*) + 1 as rank
       FROM (
         SELECT
           COALESCE(public_id, username) as identity,
           COUNT(*) as wins,
           SUM(score) as total_score
         FROM player_stats
         WHERE guild_id = ?
           AND game_start >= ?
         GROUP BY guild_id, identity
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
