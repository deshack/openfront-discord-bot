import { GameMode, GameType } from "./api_schemas";
import { getClanSessions, getGameInfo, getPlayerSessions } from "./api_util";
import { listPlayerRegistrationsByGuild } from "./db";
import { recordPlayerWin } from "./stats";

export interface ScanResult {
  clanWinsProcessed: number;
  clanPlayersRecorded: number;
  ffaWinsProcessed: number;
}

const DELAY_BETWEEN_API_CALLS_MS = 100;

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scanHistoricalWins(
  db: D1Database,
  guildId: string,
  clanTag: string | null,
  startDate: string,
  endDate: string,
): Promise<ScanResult> {
  const result: ScanResult = {
    clanWinsProcessed: 0,
    clanPlayersRecorded: 0,
    ffaWinsProcessed: 0,
  };

  if (clanTag) {
    const clanResult = await scanClanWins(db, guildId, clanTag, startDate, endDate);
    result.clanWinsProcessed = clanResult.winsProcessed;
    result.clanPlayersRecorded = clanResult.playersRecorded;
  }

  const ffaResult = await scanFFAWins(db, guildId, startDate, endDate);
  result.ffaWinsProcessed = ffaResult.winsProcessed;

  return result;
}

interface ClanScanResult {
  winsProcessed: number;
  playersRecorded: number;
}

async function scanClanWins(
  db: D1Database,
  guildId: string,
  clanTag: string,
  startDate: string,
  endDate: string,
): Promise<ClanScanResult> {
  const result: ClanScanResult = {
    winsProcessed: 0,
    playersRecorded: 0,
  };

  const sessionsData = await getClanSessions(clanTag, startDate, endDate);
  if (!sessionsData) {
    return result;
  }

  const wins = sessionsData.data.filter((session) => session.hasWon);

  for (const win of wins) {
    await delay(DELAY_BETWEEN_API_CALLS_MS);

    const gameInfoData = await getGameInfo(win.gameId, { includeTurns: false });
    if (!gameInfoData) {
      continue;
    }

    const clanPlayers = gameInfoData.data.info.players.filter(
      (player) => player.clanTag === clanTag,
    );

    for (const player of clanPlayers) {
      await recordPlayerWin(
        db,
        guildId,
        player.username,
        win.gameId,
        win.score,
        win.gameStart,
      );
      result.playersRecorded++;
    }

    result.winsProcessed++;
  }

  return result;
}

interface FFAScanResult {
  winsProcessed: number;
}

async function scanFFAWins(
  db: D1Database,
  guildId: string,
  startDate: string,
  endDate: string,
): Promise<FFAScanResult> {
  const result: FFAScanResult = {
    winsProcessed: 0,
  };

  const registrations = await listPlayerRegistrationsByGuild(db, guildId);
  if (registrations.length === 0) {
    return result;
  }

  const processedGames = new Set<string>();

  for (const registration of registrations) {
    await delay(DELAY_BETWEEN_API_CALLS_MS);

    const sessionsData = await getPlayerSessions(
      registration.playerId,
      startDate,
      endDate,
    );

    if (!sessionsData) {
      continue;
    }

    const ffaWins = sessionsData.data.filter(
      (session) =>
        session.hasWon &&
        session.gameType === GameType.Public &&
        session.gameMode === GameMode.FFA,
    );

    for (const win of ffaWins) {
      const gameKey = `${registration.playerId}:${win.gameId}`;
      if (processedGames.has(gameKey)) {
        continue;
      }

      await delay(DELAY_BETWEEN_API_CALLS_MS);

      const gameInfoData = await getGameInfo(win.gameId, { includeTurns: false });
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
        guildId,
        winnerPlayer.username,
        win.gameId,
        winnerScore,
        gameInfo.start.toISOString(),
      );

      processedGames.add(gameKey);
      result.winsProcessed++;
    }
  }

  return result;
}
