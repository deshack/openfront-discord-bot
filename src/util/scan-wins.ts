import { ScanWinsMessage } from "../types/queue";
import {
  createScanJob,
  createScanJobPlayerStatement,
  listGuildConfigsByGuild,
  listPlayerRegistrationsByGuild,
} from "./db";

export async function initClanSessions(
  db: D1Database,
  queue: Queue<ScanWinsMessage>,
  guildId: string,
  channelId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const guildConfigs = await listGuildConfigsByGuild(db, guildId);

  if (guildConfigs.length === 0) {
    console.warn(`No clan tags configured for guild ${guildId}. Skipping scan.`);

    return;
  }

  const messages = guildConfigs.map((config) => ({
    body: {
      guildId,
      channelId,
      clanTag: config.clanTag,
      startDate,
      endDate,
    } satisfies ScanWinsMessage,
  }));

  for (let i = 0; i < messages.length; i += 100) {
    await queue.sendBatch(messages.slice(i, i + 100));
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

  const statements = registrations.map((r) =>
    createScanJobPlayerStatement(db, jobId, r.playerId),
  );

  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100));
  }

  return {
    success: true,
    message: `Queued scan for ${registrations.length} registered player(s).`,
  };
}
