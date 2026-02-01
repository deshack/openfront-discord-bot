export type LeaderboardPeriod = "monthly" | "all_time";

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

function getStartOfCurrentMonth(): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  return Math.floor(startOfMonth.getTime() / 1000);
}

export function getEndOfCurrentMonth(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

export async function recordPlayerWin(
  db: D1Database,
  guildId: string,
  username: string,
  matchId: string,
  score: number,
  gameStart: string,
): Promise<void> {
  const gameStartTimestamp = Math.floor(new Date(gameStart).getTime() / 1000);

  await db
    .prepare(
      `INSERT INTO player_stats (guild_id, username, match_id, score, game_start)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, username, match_id) DO NOTHING`,
    )
    .bind(guildId, username, matchId, score, gameStartTimestamp)
    .run();
}

export async function getLeaderboard(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  limit: number,
  offset: number,
): Promise<LeaderboardResult> {
  const startTimestamp = period === "monthly" ? getStartOfCurrentMonth() : 0;

  const countResult = await db
    .prepare(
      `SELECT COUNT(DISTINCT username) as count
       FROM player_stats
       WHERE guild_id = ?
         AND game_start >= ?`,
    )
    .bind(guildId, startTimestamp)
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
         AND game_start >= ?
       GROUP BY guild_id, username
       ORDER BY wins DESC, total_score DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(guildId, startTimestamp, limit, offset)
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
  const startTimestamp = period === "monthly" ? getStartOfCurrentMonth() : 0;

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
