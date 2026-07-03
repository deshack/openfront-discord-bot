import { Env } from "../types/env";
import type { ClanWinsMessage, FFAWinsMessage } from "../types/queue";
import { GameMode, GameType } from "../util/api_schemas";
import { getGameInfo, getPlayerSessions } from "../util/api_util";
import { splitInto24hWindows } from "../util/date_util";
import {
  claimNextPendingJob,
  completeClanSessionJob,
  completeFFAGameJob,
  completePlayerJob,
  completeScanJob,
  countPendingClanSessionJobs,
  countPendingFFAGames,
  countPendingPlayers,
  createScanJobFFAGame,
  failScanJob,
  getClanSessionsJobBatch,
  getFFAGamesJobBatch,
  getPlayersJobBatch,
  listAllPlayerRegistrations,
  listGuildConfigs,
  listGuildConfigsByGuild,
  ScanJob,
  ScanJobClanSession,
  ScanJobFFAGame,
  ScanJobPlayer,
} from "../util/db";
import { sendChannelMessage } from "../util/discord";
import { recordPlayerWin } from "../util/stats";

// const DAILY_QUEUE_LIMIT = 10_000;
// const OPS_PER_MESSAGE = 2;
// const RUNS_PER_DAY = 288; // every 5 min
// const MAX_MESSAGES_PER_RUN = Math.floor(DAILY_QUEUE_LIMIT / (OPS_PER_MESSAGE * RUNS_PER_DAY)); // = 17
const MAX_MESSAGES_PER_RUN = 12;

export async function handleScanJobs(env: Env): Promise<void> {
  console.debug("Running scheduled task for scan jobs.");

  const job = await claimNextPendingJob(env.DB);
  if (!job) {
    return;
  }

  console.info(
    `Claimed scan job ${job.id} for guild ${job.guildId}, status: ${job.status}`,
  );

  try {
    if (job.jobType === "clan") {
      const clanSessions: ScanJobClanSession[] = await getClanSessionsJobBatch(
        env.DB,
        job.id,
      );

      await Promise.all(
        clanSessions.map((session) => handleClanSessionJob(env, job, session)),
      );

      const remainingGames =
        (await countPendingClanSessionJobs(env.DB, job.id)) ?? 0;

      console.debug("remaining games: ", JSON.stringify(remainingGames) + "");

      if (remainingGames === 0) {
        await completeScanJob(env.DB, job.id);
        await notifyJobComplete(env, job);
      }

      return;
    } else if (job.jobType === "players") {
      const pendingPlayers = await countPendingPlayers(env.DB, job.id);

      if (pendingPlayers > 0) {
        await handlePlayerDiscovery(env, job);
      } else {
        await handleFFAGamesProcessing(env, job);
      }

      return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing scan job ${job.id}:`, error);

    await failScanJob(env.DB, job.id, errorMessage);

    throw error;
  }
}

async function handleClanSessionJob(
  env: Env,
  job: ScanJob,
  session: ScanJobClanSession,
): Promise<void> {
  const gameInfoData = await getGameInfo(session.gameId, {
    includeTurns: false,
  }, env);

  const clanPlayerUsernames: string[] =
    gameInfoData?.data.info.players
      .filter((player) => player.clanTag === job.clanTag)
      .map((player) => player.username) ?? [];

  for (const username of clanPlayerUsernames) {
    await recordPlayerWin(
      env.DB,
      job.guildId,
      username,
      session.gameId,
      GameMode.Team,
      session.score,
      gameInfoData!.data.info.start.toISOString(),
    );
  }

  await completeClanSessionJob(env.DB, job.id, session.gameId);
}

async function notifyJobComplete(env: Env, job: ScanJob): Promise<void> {
  await sendChannelMessage(env.DISCORD_TOKEN, job.channelId, {
    content: "**Scan Complete**",
  });
}

async function handlePlayerDiscovery(env: Env, job: ScanJob): Promise<void> {
  const players = await getPlayersJobBatch(env.DB, job.id, 5);

  if (players.length === 0) {
    return;
  }

  console.info(
    `Processing ${players.length} players for job ${job.id} (discovery phase)`,
  );

  await Promise.all(
    players.map((player) => processPlayerDiscovery(env, job, player)),
  );
}

async function processPlayerDiscovery(
  env: Env,
  job: ScanJob,
  player: ScanJobPlayer,
): Promise<void> {
  if (!job.startDate || !job.endDate) {
    console.error(`Job ${job.id} missing date range for player discovery`);
    await completePlayerJob(env.DB, job.id, player.playerId);

    return;
  }

  try {
    const sessionsData = await getPlayerSessions(
      player.playerId,
      job.startDate,
      job.endDate,
      env,
    );

    if (!sessionsData) {
      console.debug(
        `No sessions found for player ${player.playerId} in job ${job.id}`,
      );
      await completePlayerJob(env.DB, job.id, player.playerId);

      return;
    }

    const guildConfigs = await listGuildConfigsByGuild(env.DB, job.guildId);

    const ffaWins = sessionsData.data.filter(
      (session) =>
        session.hasWon &&
        session.gameType === GameType.Public &&
        session.gameMode === GameMode.FFA &&
        guildConfigs.some((c) => c.clanTag === session.clanTag),
    );

    console.debug(
      `Found ${ffaWins.length} FFA wins for player ${player.playerId} in guild ${job.guildId}`,
    );

    for (const win of ffaWins) {
      await createScanJobFFAGame(env.DB, job.id, win.gameId);
    }

    await completePlayerJob(env.DB, job.id, player.playerId);
  } catch (error) {
    console.error(
      `Error processing player ${player.playerId} in job ${job.id}:`,
      error,
    );
    await completePlayerJob(env.DB, job.id, player.playerId);
  }
}

async function handleFFAGamesProcessing(env: Env, job: ScanJob): Promise<void> {
  const games = await getFFAGamesJobBatch(env.DB, job.id, 40);

  if (games.length === 0) {
    const pendingGames = await countPendingFFAGames(env.DB, job.id);

    if (pendingGames === 0) {
      await completeScanJob(env.DB, job.id);
      await notifyJobComplete(env, job);
    }

    return;
  }

  console.info(
    `Processing ${games.length} FFA games for job ${job.id} (processing phase)`,
  );

  await Promise.all(games.map((game) => processFFAGame(env, job, game)));

  const remainingGames = await countPendingFFAGames(env.DB, job.id);

  if (remainingGames === 0) {
    await completeScanJob(env.DB, job.id);
    await notifyJobComplete(env, job);
  }
}

async function processFFAGame(
  env: Env,
  job: ScanJob,
  game: ScanJobFFAGame,
): Promise<void> {
  try {
    const gameInfoData = await getGameInfo(game.gameId, {
      includeTurns: false,
    }, env);

    if (!gameInfoData) {
      console.debug(`Game ${game.gameId} not found`);
      await completeFFAGameJob(env.DB, job.id, game.gameId);

      return;
    }

    const gameInfo = gameInfoData.data.info;

    if (
      gameInfo.config.rankedType !== null &&
      gameInfo.config.rankedType !== undefined
    ) {
      console.debug(`Game ${game.gameId} is ranked, skipping`);
      await completeFFAGameJob(env.DB, job.id, game.gameId);

      return;
    }

    if (!gameInfo.winner) {
      console.debug(`Game ${game.gameId} has no winner, skipping`);
      await completeFFAGameJob(env.DB, job.id, game.gameId);

      return;
    }

    const winnerPlayer = gameInfo.players.find(
      (p) => p.clientID === gameInfo.winner?.clientID,
    );

    if (!winnerPlayer) {
      console.debug(`Winner not found in game ${game.gameId}`);
      await completeFFAGameJob(env.DB, job.id, game.gameId);

      return;
    }

    const guildConfigs = await listGuildConfigsByGuild(env.DB, job.guildId);

    if (!guildConfigs.some((c) => c.clanTag === winnerPlayer.clanTag)) {
      console.debug(
        `Winner ${winnerPlayer.username} in game ${game.gameId} does not match any subscribed clan tag for guild ${job.guildId}`,
      );
      await completeFFAGameJob(env.DB, job.id, game.gameId);

      return;
    }

    await recordPlayerWin(
      env.DB,
      job.guildId,
      winnerPlayer.username,
      game.gameId,
      GameMode.FFA,
      0,
      gameInfo.start.toISOString(),
    );

    console.debug(
      `Recorded FFA win for ${winnerPlayer.username} in game ${game.gameId}`,
    );

    await completeFFAGameJob(env.DB, job.id, game.gameId);
  } catch (error) {
    console.error(
      `Error processing game ${game.gameId} in job ${job.id}:`,
      error,
    );
    await completeFFAGameJob(env.DB, job.id, game.gameId);
  }
}

export async function handleClanWins(
  env: Env,
  hours = 2,
  clanTag?: string,
): Promise<void> {
  console.debug("Running scheduled task for clan wins.");

  const configs = await listGuildConfigs(env.DB);
  const filteredConfigs = clanTag
    ? configs.filter((c) => c.config.clanTag === clanTag)
    : configs;

  if (filteredConfigs.length === 0) {
    console.info("No clan wins configs found. Skipping scheduled task.");

    return;
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const windows = splitInto24hWindows(startDate, now);

  const clanTags = [...new Set(filteredConfigs.map((c) => c.config.clanTag))];

  const batchSize = Math.ceil(clanTags.length / MAX_MESSAGES_PER_RUN);
  const chunks: string[][] = [];
  for (let i = 0; i < clanTags.length; i += batchSize) {
    chunks.push(clanTags.slice(i, i + batchSize));
  }

  const messages = windows.flatMap((w) =>
    chunks.map((tags) => ({
      body: { clanTags: tags, start: w.start, end: w.end } satisfies ClanWinsMessage,
    })),
  );

  for (let i = 0; i < messages.length; i += 100) {
    await env.CLAN_WINS_QUEUE.sendBatch(messages.slice(i, i + 100));
  }

  console.info(
    `Dispatched ${messages.length} clan win messages to queue (${clanTags.length} tags × ${windows.length} window(s)).`,
  );
}

export async function handleFFAWins(env: Env, hours = 2): Promise<void> {
  console.debug("Running scheduled task for FFA wins.");

  const guildRegistrations = await listAllPlayerRegistrations(env.DB);

  if (guildRegistrations.length === 0) {
    console.info("No FFA wins configs found. Skipping scheduled task.");

    return;
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const windows = splitInto24hWindows(startDate, now);

  const playerIds = new Set<string>();
  for (const { registrations } of guildRegistrations) {
    for (const reg of registrations) {
      playerIds.add(reg.playerId);
    }
  }

  const ids = [...playerIds];
  const batchSize = Math.ceil(ids.length / MAX_MESSAGES_PER_RUN);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }

  const messages = windows.flatMap((w) =>
    chunks.map((pids) => ({
      body: { playerIds: pids, start: w.start, end: w.end } satisfies FFAWinsMessage,
    })),
  );

  for (let i = 0; i < messages.length; i += 100) {
    await env.FFA_WINS_QUEUE.sendBatch(messages.slice(i, i + 100));
  }

  console.info(
    `Dispatched ${messages.length} FFA player messages to queue (${ids.length} players × ${windows.length} window(s)).`,
  );
}
