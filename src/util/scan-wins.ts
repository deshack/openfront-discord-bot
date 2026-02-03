import { getClanSessions } from "./api_util";
import {
  createScanJob,
  createScanJobClanSession,
  createScanJobPlayer,
  getGuildConfig,
  listPlayerRegistrationsByGuild,
} from "./db";

export async function initClanSessions(
  db: D1Database,
  guildId: string,
  channelId: string,
  startDate: string,
  endDate: string,
) {
  const guildConfig = await getGuildConfig(db, guildId);
  const clanTag = guildConfig?.clanTag ?? null;

  if (!clanTag) {
    console.warn(`Clan tag not found for guild ${guildId}. Skipping scan.`);

    return;
  }

  const sessionsData = await getClanSessions(clanTag, startDate, endDate);

  if (!sessionsData) {
    console.debug(`No clan sessions found for clan ${clanTag}. Skipping scan. StartDate: ${startDate}, EndDate: ${endDate}`);

    return;
  }

  const wins = sessionsData.data.filter((session) => session.hasWon);

  if (wins.length <= 0) {
    console.debug("No wins found for clan sessions. Skipping scan.");

    return;
  }

  const jobId = await createScanJob(db, guildId, channelId, clanTag, "clan");

  for (const win of wins) {
    await createScanJobClanSession(db, jobId, win.gameId, win.score);
  }
}

export interface InitPlayerSessionsResult {
  success: boolean;
  message?: string;
}

export async function initPlayerSessions(
  db: D1Database,
  guildId: string,
  channelId: string,
  startDate: string,
  endDate: string,
): Promise<InitPlayerSessionsResult> {
  const guildConfig = await getGuildConfig(db, guildId);
  const clanTag = guildConfig?.clanTag ?? null;

  if (!clanTag) {
    return {
      success: false,
      message:
        "Guild is not configured. Please run `/setup` to configure your clan tag.",
    };
  }

  const registrations = await listPlayerRegistrationsByGuild(db, guildId);

  if (registrations.length === 0) {
    return {
      success: false,
      message:
        "No players registered. Players must use `/register` before scanning.",
    };
  }

  const jobId = await createScanJob(db, guildId, channelId, clanTag, "players", {
    startDate,
    endDate,
  });

  for (const registration of registrations) {
    await createScanJobPlayer(db, jobId, registration.playerId);
  }

  return {
    success: true,
    message: `Queued scan for ${registrations.length} registered player(s).`,
  };
}
