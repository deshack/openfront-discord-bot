import { GameMode, GameType } from "./api_schemas";
import { getClanSessions, getGameInfo, getPlayerSessions } from "./api_util";
import {
  initializeScanJobClanGames,
  initializeScanJobFFAPlayers,
  listPlayerRegistrationsByGuild,
  ScanJob,
  updateScanJobClanProgress,
  updateScanJobFFAProgress,
  updateScanJobStatus,
} from "./db";
import { recordPlayerWin } from "./stats";

export interface ScanResult {
  clanWinsProcessed: number;
  clanPlayersRecorded: number;
  ffaWinsProcessed: number;
}

const BATCH_SIZE = 30;
const DELAY_BETWEEN_API_CALLS_MS = 100;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initializeScanJob(
  db: D1Database,
  job: ScanJob,
): Promise<void> {
  if (job.clanTag) {
    const sessionsData = await getClanSessions(
      job.clanTag,
      job.startDate,
      job.endDate,
    );

    if (sessionsData) {
      const winningGameIds = sessionsData.data
        .filter((session) => session.hasWon)
        .map((session) => `${session.gameId}:${session.score}`);

      await initializeScanJobClanGames(db, job.id, winningGameIds);

      return;
    }
  }

  const registrations = await listPlayerRegistrationsByGuild(db, job.guildId);
  const playerIds = registrations.map((r) => r.playerId);

  if (playerIds.length > 0) {
    await initializeScanJobFFAPlayers(db, job.id, playerIds);
  } else {
    await updateScanJobStatus(db, job.id, "completed");
  }
}

export interface ClanBatchResult {
  hasMore: boolean;
  gamesProcessed: number;
  playersRecorded: number;
}

export async function processClanBatch(
  db: D1Database,
  job: ScanJob,
): Promise<ClanBatchResult> {
  if (!job.clanGames || !job.clanTag) {
    return { hasMore: false, gamesProcessed: 0, playersRecorded: 0 };
  }

  const startIndex = job.clanGamesProcessed;
  const endIndex = Math.min(startIndex + BATCH_SIZE, job.clanGames.length);
  const gamesToProcess = job.clanGames.slice(startIndex, endIndex);

  let playersRecorded = job.clanPlayersRecorded;

  for (const gameIdString of gamesToProcess) {
    await delay(DELAY_BETWEEN_API_CALLS_MS);

    const [gameId, score] = gameIdString.split(":");

    const gameInfoData = await getGameInfo(gameId, { includeTurns: false });
    if (!gameInfoData) {
      continue;
    }

    const gameInfo = gameInfoData.data.info;
    const clanPlayers = gameInfo.players.filter(
      (player) => player.clanTag === job.clanTag,
    );

    const scoreFloat = parseFloat(score);
    const winScore = isNaN(scoreFloat) ? 0 : scoreFloat;
    for (const player of clanPlayers) {
      await recordPlayerWin(
        db,
        job.guildId,
        player.username,
        gameId,
        winScore,
        gameInfo.start.toISOString(),
      );
      playersRecorded++;
    }
  }

  const gamesProcessed = endIndex;
  await updateScanJobClanProgress(db, job.id, gamesProcessed, playersRecorded);

  const hasMore = endIndex < job.clanGames.length;

  return { hasMore, gamesProcessed: gamesToProcess.length, playersRecorded };
}

export interface FFABatchResult {
  hasMore: boolean;
  winsProcessed: number;
}

export async function processFFABatch(
  db: D1Database,
  job: ScanJob,
): Promise<FFABatchResult> {
  if (!job.ffaPlayerIds || job.ffaPlayerIds.length === 0) {
    return { hasMore: false, winsProcessed: 0 };
  }

  const currentPlayerIndex = job.ffaPlayerIndex;

  if (currentPlayerIndex >= job.ffaPlayerIds.length) {
    return { hasMore: false, winsProcessed: 0 };
  }

  const playerId = job.ffaPlayerIds[currentPlayerIndex];
  let totalWinsProcessed = job.ffaWinsProcessed;
  let winsInThisBatch = 0;

  await delay(DELAY_BETWEEN_API_CALLS_MS);

  const sessionsData = await getPlayerSessions(
    playerId,
    job.startDate,
    job.endDate,
  );

  if (sessionsData) {
    const ffaWins = sessionsData.data.filter(
      (session) =>
        session.hasWon &&
        session.gameType === GameType.Public &&
        session.gameMode === GameMode.FFA,
    );

    const winsToProcess = ffaWins.slice(0, BATCH_SIZE);

    for (const win of winsToProcess) {
      await delay(DELAY_BETWEEN_API_CALLS_MS);

      const gameInfoData = await getGameInfo(win.gameId, {
        includeTurns: false,
      });
      if (!gameInfoData) {
        continue;
      }

      const gameInfo = gameInfoData.data.info;
      const isNot1v1 = gameInfo.players.length > 2;

      if (!isNot1v1 || !gameInfo.winner) {
        continue;
      }

      const winnerPlayer = gameInfo.players.find(
        (p) => p.clientID === gameInfo.winner?.clientID,
      );

      if (!winnerPlayer) {
        continue;
      }

      const winnerScore = winnerPlayer.stats.gold?.[0] ?? 0;

      await recordPlayerWin(
        db,
        job.guildId,
        winnerPlayer.username,
        win.gameId,
        winnerScore,
        gameInfo.start.toISOString(),
      );

      totalWinsProcessed++;
      winsInThisBatch++;
    }
  }

  const nextPlayerIndex = currentPlayerIndex + 1;
  await updateScanJobFFAProgress(
    db,
    job.id,
    nextPlayerIndex,
    totalWinsProcessed,
  );

  const hasMore = nextPlayerIndex < job.ffaPlayerIds.length;

  return { hasMore, winsProcessed: winsInThisBatch };
}

export async function transitionToFFAProcessing(
  db: D1Database,
  job: ScanJob,
): Promise<boolean> {
  const registrations = await listPlayerRegistrationsByGuild(db, job.guildId);
  const playerIds = registrations.map((r) => r.playerId);

  if (playerIds.length === 0) {
    return false;
  }

  await initializeScanJobFFAPlayers(db, job.id, playerIds);

  return true;
}
