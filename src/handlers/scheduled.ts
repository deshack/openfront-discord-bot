import { getClanWinMessage } from "../messages/clan_win";
import { getFFAWinMessage } from "../messages/ffa_win";
import { Env } from "../types/env";
import { GameMode, GameType } from "../util/api_schemas";
import {
  getClanSessions,
  getGameInfo,
  getPlayerSessions,
} from "../util/api_util";
import { listAllPlayerRegistrations, listGuildConfigs } from "../util/db";
import { sendChannelMessage } from "../util/discord";
import {
  isFFAGamePosted,
  isGamePosted,
  markFFAGamePosted,
  markGamePosted,
} from "../util/kv";

export async function handleScheduled(env: Env): Promise<void> {
  await Promise.all([handleClanWins(env), handleFFAWins(env)]);
}

async function handleClanWins(env: Env): Promise<void> {
  console.debug('Running scheduled task for clan wins.');

  const configs = await listGuildConfigs(env.DB);

  if (configs.length === 0) {
    console.info('No clan wins configs found. Skipping scheduled task.');

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
        if (gameInfoData) {
          clanPlayerUsernames = gameInfoData.data.info.players
            .filter((player) => player.clanTag === config.clanTag)
            .map((player) => player.username);

          map = gameInfoData.data.info.config.gameMap;
        }

        const message = getClanWinMessage(win, clanPlayerUsernames, map);
        const success = await sendChannelMessage(
          env.DISCORD_TOKEN,
          config.channelId,
          message,
        );

        if (success) {
          await markGamePosted(env.DATA, guildId, win.gameId);
        }
      }
    } catch (error) {
      console.error(`Error processing clan wins for guild ${guildId}:`, error);
    }
  }
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

  for (const { guildId, registrations } of guildRegistrations) {
    for (const registration of registrations) {
      try {
        const sessionsData = await getPlayerSessions(
          registration.playerId,
          start,
          end,
        );
        if (!sessionsData) {
          continue;
        }

        const ffaWins = sessionsData.data.filter(
          (session) =>
            session.hasWon &&
            session.gameType === GameType.Public &&
            session.gameMode === GameMode.FFA &&
            session.gameStart >= startDate.toISOString(),
        );

        for (const win of ffaWins) {
          const alreadyPosted = await isFFAGamePosted(
            env.DATA,
            guildId,
            registration.playerId,
            win.gameId,
          );
          if (alreadyPosted) {
            continue;
          }

          const message = getFFAWinMessage(
            registration.discordUserId,
            win.gameId,
          );
          const success = await sendChannelMessage(
            env.DISCORD_TOKEN,
            registration.channelId,
            message,
          );

          if (success) {
            await markFFAGamePosted(
              env.DATA,
              guildId,
              registration.playerId,
              win.gameId,
            );
          }
        }
      } catch (error) {
        console.error(
          `Error processing FFA wins for player ${registration.playerId} in guild ${guildId}:`,
          error,
        );
      }
    }
  }
}
