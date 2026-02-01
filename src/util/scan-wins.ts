import { getClanSessions } from "./api_util";
import { createScanJob, createScanJobClanSession, getGuildConfig } from "./db";

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
