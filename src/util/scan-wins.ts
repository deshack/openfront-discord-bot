import { getClanSessions } from "./api_util";
import {
  createScanJob,
  createScanJobClanSession,
  createScanJobPlayer,
  listGuildConfigsByGuild,
  listPlayerRegistrationsByGuild,
} from "./db";

export async function initClanSessions(
  db: D1Database,
  guildId: string,
  channelId: string,
  startDate: string,
  endDate: string,
) {
  const guildConfigs = await listGuildConfigsByGuild(db, guildId);

  if (guildConfigs.length === 0) {
    console.warn(`No clan tags configured for guild ${guildId}. Skipping scan.`);

    return;
  }

  for (const config of guildConfigs) {
    const sessionsData = await getClanSessions(config.clanTag, startDate, endDate);

    if (!sessionsData) {
      console.debug(
        `No clan sessions found for clan ${config.clanTag}. Skipping. StartDate: ${startDate}, EndDate: ${endDate}`,
      );

      continue;
    }

    const wins = sessionsData.data.filter((session) => session.hasWon);

    if (wins.length <= 0) {
      console.debug(`No wins found for clan ${config.clanTag}. Skipping.`);

      continue;
    }

    const jobId = await createScanJob(db, guildId, channelId, config.clanTag, "clan");

    for (const win of wins) {
      await createScanJobClanSession(db, jobId, win.gameId, win.score);
    }
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
  const guildConfigs = await listGuildConfigsByGuild(db, guildId);

  if (guildConfigs.length === 0) {
    return {
      success: false,
      message:
        "Guild is not configured. Please run `/setup wins` to configure your clan tag.",
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

  const jobId = await createScanJob(
    db,
    guildId,
    channelId,
    null,
    "players",
    {
      startDate,
      endDate,
    },
  );

  for (const registration of registrations) {
    await createScanJobPlayer(db, jobId, registration.playerId);
  }

  return {
    success: true,
    message: `Queued scan for ${registrations.length} registered player(s).`,
  };
}
