import { getClanWinMessage } from "../messages/clan_win";
import { getFFAWinMessage } from "../messages/ffa_win";
import { Env } from "../types/env";
import { GameMode, GameType } from "../util/api_schemas";
import {
  getClanSessions,
  getGameInfo,
  getPlayerSessions,
} from "../util/api_util";
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
  getGuildConfig,
  getUsernameMappingsByUsernames,
  getPlayersJobBatch,
  listAllPlayerRegistrations,
  listGuildConfigs,
  ScanJob,
  ScanJobClanSession,
  ScanJobFFAGame,
  ScanJobPlayer,
  stripClanTag,
} from "../util/db";
import { sendChannelMessage } from "../util/discord";
import {
  isFFAGamePosted,
  isGamePosted,
  markFFAGamePosted,
  markGamePosted,
} from "../util/kv";
import { checkPremiumForScheduled } from "../util/premium";
import { recordPlayerWin } from "../util/stats";

export async function handleScheduled(env: Env): Promise<void> {
  await Promise.all([handleClanWins(env), handleFFAWins(env)]);
}

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
  });

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
    );

    if (!sessionsData) {
      console.debug(
        `No sessions found for player ${player.playerId} in job ${job.id}`,
      );
      await completePlayerJob(env.DB, job.id, player.playerId);

      return;
    }

    const ffaWins = sessionsData.data.filter(
      (session) =>
        session.hasWon &&
        session.gameType === GameType.Public &&
        session.gameMode === GameMode.FFA &&
        session.clanTag === job.clanTag,
    );

    console.debug(
      `Found ${ffaWins.length} FFA wins for player ${player.playerId} with clan tag ${job.clanTag}`,
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
    const gameInfoData = await getGameInfo(game.gameId, { includeTurns: false });

    if (!gameInfoData) {
      console.debug(`Game ${game.gameId} not found`);
      await completeFFAGameJob(env.DB, job.id, game.gameId);

      return;
    }

    const gameInfo = gameInfoData.data.info;

    if (gameInfo.config.rankedType !== null && gameInfo.config.rankedType !== undefined) {
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

    if (winnerPlayer.clanTag !== job.clanTag) {
      console.debug(
        `Winner ${winnerPlayer.username} in game ${game.gameId} does not have clan tag ${job.clanTag}`,
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
    console.error(`Error processing game ${game.gameId} in job ${job.id}:`, error);
    await completeFFAGameJob(env.DB, job.id, game.gameId);
  }
}

async function handleClanWins(env: Env): Promise<void> {
  console.debug("Running scheduled task for clan wins.");

  const configs = await listGuildConfigs(env.DB);

  if (configs.length === 0) {
    console.info("No clan wins configs found. Skipping scheduled task.");

    return;
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const start = startDate.toISOString();
  const end = now.toISOString();

  for (const { guildId, config } of configs) {
    try {
      const sessionsData = await getClanSessions(config.clanTag, start, end);
      if (!sessionsData) {
        continue;
      }

      const wins = sessionsData.data.filter((session) => session.hasWon);

      for (const win of wins) {
        const alreadyPosted = await isGamePosted(env.DATA, guildId, win.gameId);
        if (alreadyPosted) {
          continue;
        }

        const gameInfoData = await getGameInfo(win.gameId, {
          includeTurns: false,
        });

        let clanPlayerUsernames: string[] = [];
        let map: string = "Unknown";
        let duration: number | undefined;
        if (gameInfoData) {
          clanPlayerUsernames = gameInfoData.data.info.players
            .filter((player) => player.clanTag === config.clanTag)
            .map((player) => player.username);

          map = gameInfoData.data.info.config.gameMap;
          duration = gameInfoData.data.info.duration;
        }

        const usernameMappings = await getUsernameMappingsByUsernames(
          env.DB,
          guildId,
          clanPlayerUsernames.map((u) => stripClanTag(u)),
        );

        const message = getClanWinMessage(
          win,
          clanPlayerUsernames,
          map,
          duration,
          usernameMappings,
        );
        const success = await sendChannelMessage(
          env.DISCORD_TOKEN,
          config.channelId,
          message,
        );

        if (success) {
          await markGamePosted(env.DATA, guildId, win.gameId);

          const premiumStatus = await checkPremiumForScheduled(
            env.DB,
            env.DISCORD_TOKEN,
            env.DISCORD_CLIENT_ID,
            env.DISCORD_SKU_ID,
            guildId,
          );

          if (premiumStatus.isPremium && clanPlayerUsernames.length > 0) {
            for (const username of clanPlayerUsernames) {
              await recordPlayerWin(
                env.DB,
                guildId,
                username,
                win.gameId,
                GameMode.Team,
                win.score,
                win.gameStart,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing clan wins for guild ${guildId}:`, error);
    }
  }
}

interface FFAWinToPost {
  guildId: string;
  playerId: string;
  discordUserId: string;
  channelId: string;
  gameId: string;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);

  return results;
}

async function handleFFAWins(env: Env): Promise<void> {
  console.debug("Running scheduled task for FFA wins.");

  const guildRegistrations = await listAllPlayerRegistrations(env.DB);

  if (guildRegistrations.length === 0) {
    console.info("No FFA wins configs found. Skipping scheduled task.");

    return;
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const start = startDate.toISOString();
  const end = now.toISOString();

  const allRegistrations = guildRegistrations.flatMap(
    ({ guildId, registrations }) =>
      registrations.map((registration) => ({ guildId, registration })),
  );

  const sessionsResults = await mapWithConcurrency(
    allRegistrations,
    5,
    async ({ guildId, registration }) => {
      try {
        const sessionsData = await getPlayerSessions(
          registration.playerId,
          start,
          end,
        );

        if (!sessionsData) {
          return [];
        }

        const ffaWins = sessionsData.data.filter(
          (session) =>
            session.hasWon &&
            session.gameType === GameType.Public &&
            session.gameMode === GameMode.FFA &&
            session.gameStart >= startDate.toISOString(),
        );

        return ffaWins.map((win) => ({
          guildId,
          playerId: registration.playerId,
          discordUserId: registration.discordUserId,
          channelId: registration.channelId,
          gameId: win.gameId,
        }));
      } catch (error) {
        console.error(
          `Error fetching sessions for player ${registration.playerId} in guild ${guildId}:`,
          error,
        );

        return [];
      }
    },
  );

  const allWins = sessionsResults.flat();

  const dedupeKey = (win: FFAWinToPost) =>
    `${win.guildId}:${win.playerId}:${win.gameId}`;
  const seenKeys = new Set<string>();
  const uniqueWins = allWins.filter((win) => {
    const key = dedupeKey(win);
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);

    return true;
  });

  for (const win of uniqueWins) {
    try {
      const alreadyPosted = await isFFAGamePosted(
        env.DATA,
        win.guildId,
        win.playerId,
        win.gameId,
      );

      if (alreadyPosted) {
        continue;
      }

      const gameInfoData = await getGameInfo(win.gameId, {
        includeTurns: false,
      });

      const message = getFFAWinMessage({
        discordUserId: win.discordUserId,
        gameId: win.gameId,
        gameInfo: gameInfoData?.data.info,
      });
      const success = await sendChannelMessage(
        env.DISCORD_TOKEN,
        win.channelId,
        message,
      );

      if (success) {
        await markFFAGamePosted(
          env.DATA,
          win.guildId,
          win.playerId,
          win.gameId,
        );

        const gameInfo = gameInfoData?.data.info;
        const isNot1v1 = gameInfo && gameInfo.players.length > 2;

        if (isNot1v1 && gameInfo.winner) {
          const premiumStatus = await checkPremiumForScheduled(
            env.DB,
            env.DISCORD_TOKEN,
            env.DISCORD_CLIENT_ID,
            env.DISCORD_SKU_ID,
            win.guildId,
          );

          if (premiumStatus.isPremium) {
            const guildConfig = await getGuildConfig(env.DB, win.guildId);
            const clanTag = guildConfig?.clanTag ?? null;

            if (!clanTag) {
              continue;
            }

            const winnerPlayer = gameInfo.players.find(
              (p) =>
                p.clientID === gameInfo.winner?.clientID &&
                p.clanTag === clanTag,
            );

            if (winnerPlayer) {
              await recordPlayerWin(
                env.DB,
                win.guildId,
                winnerPlayer.username,
                win.gameId,
                GameMode.FFA,
                0,
                gameInfo.start.toISOString(),
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `Error posting FFA win for player ${win.playerId} in guild ${win.guildId}:`,
        error,
      );
    }
  }
}
