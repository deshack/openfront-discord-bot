import { getClanWinMessage } from "../messages/clan_win";
import { getFFAWinMessage } from "../messages/ffa_win";
import { Env } from "../types/env";
import { ClanWinsMessage, FFAWinsMessage } from "../types/queue";
import { GameMode, GameType } from "../util/api_schemas";
import {
  getClanSessions,
  getGameInfo,
  getPlayerSessions,
} from "../util/api_util";
import {
  deleteGuildChannelConfig,
  deleteGuildConfig,
  getGuildConfigsByClanTag,
  listGuildChannelConfigs,
  listGuildConfigsByGuild,
  getRegistrationsByPlayerId,
  getUsernameMappingsByUsernames,
  stripClanTag,
  unregisterPlayer,
} from "../util/db";
import { sendChannelMessage } from "../util/discord";
import {
  isFFAGamePosted,
  isGamePosted,
  markFFAGamePosted,
  markGamePosted,
} from "../util/kv";
import { checkPremiumForScheduled, PremiumCheckResult } from "../util/premium";
import { recordPlayerWin } from "../util/stats";

export async function handleClanWinsQueue(
  batch: MessageBatch<ClanWinsMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      for (const clanTag of message.body.clanTags) {
        await processClanTag(
          clanTag,
          message.body.start,
          message.body.end,
          env,
        );
      }
      message.ack();
    } catch (error) {
      console.error(
        `Failed to process clan wins queue message:`,
        message.body,
        error,
      );
      message.retry();
    }
  }
}

export async function handleFFAWinsQueue(
  batch: MessageBatch<FFAWinsMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      for (const playerId of message.body.playerIds) {
        await processPlayer(
          playerId,
          message.body.start,
          message.body.end,
          env,
        );
      }
      message.ack();
    } catch (error) {
      console.error(
        `Failed to process FFA wins queue message:`,
        message.body,
        error,
      );
      message.retry();
    }
  }
}

async function processClanTag(
  clanTag: string,
  start: string,
  end: string,
  env: Env,
): Promise<void> {
  const guildEntries = await getGuildConfigsByClanTag(env.DB, clanTag);

  if (guildEntries.length === 0) {
    return;
  }

  const sessionsData = await getClanSessions(clanTag, start, end);
  if (!sessionsData) {
    return;
  }

  const wins = sessionsData.data.filter((session) => session.hasWon);

  const premiumCache = new Map<string, PremiumCheckResult>();
  const gameInfoCache = new Map<
    string,
    Awaited<ReturnType<typeof getGameInfo>>
  >();

  for (const { guildId, config } of guildEntries) {
    try {
      for (const win of wins) {
        const alreadyPosted = await isGamePosted(env.DATA, guildId, win.gameId);
        if (alreadyPosted) {
          continue;
        }

        if (!gameInfoCache.has(win.gameId)) {
          gameInfoCache.set(
            win.gameId,
            await getGameInfo(win.gameId, { includeTurns: false }),
          );
        }
        const gameInfoData = gameInfoCache.get(win.gameId);

        if (!gameInfoData) {
          console.error(`Game info unavailable for game ${win.gameId}, skipping.`);
          continue;
        }

        const clanPlayerUsernames = gameInfoData.data.info.players
          .filter(
            (player) =>
              player.clanTag === clanTag && player.stats !== undefined,
          )
          .map((player) => player.username);
        const map = gameInfoData.data.info.config.gameMap;
        const duration = gameInfoData.data.info.duration;

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
        const result = await sendChannelMessage(
          env.DISCORD_TOKEN,
          config.channelId,
          message,
        );

        if (!result.success && result.discordCode === 50001) {
          console.warn(
            `Bot removed from guild ${guildId} (Missing Access). Deleting guild config.`,
          );
          await deleteGuildConfig(env.DB, guildId);
          break;
        }

        if (result.success) {
          await markGamePosted(env.DATA, guildId, win.gameId);

          const premiumStatus =
            premiumCache.get(guildId) ??
            (await checkPremiumForScheduled(
              env.DB,
              env.DISCORD_TOKEN,
              env.DISCORD_CLIENT_ID,
              env.DISCORD_SKU_ID,
              guildId,
            ));
          premiumCache.set(guildId, premiumStatus);

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

async function processPlayer(
  playerId: string,
  start: string,
  end: string,
  env: Env,
): Promise<void> {
  const guildEntries = await getRegistrationsByPlayerId(env.DB, playerId);

  if (guildEntries.length === 0) {
    return;
  }

  const startDate = new Date(start);

  const sessionsData = await getPlayerSessions(playerId, start, end);
  if (!sessionsData) {
    return;
  }

  const ffaWins = sessionsData.data.filter(
    (session) =>
      session.hasWon &&
      session.gameType === GameType.Public &&
      session.gameMode === GameMode.FFA &&
      session.gameStart >= startDate.toISOString(),
  );

  if (ffaWins.length === 0) {
    return;
  }

  const removedGuildIds = new Set<string>();
  const premiumCache = new Map<string, PremiumCheckResult>();
  const gameInfoCache = new Map<
    string,
    Awaited<ReturnType<typeof getGameInfo>>
  >();

  const guildChannelConfigCache = new Map<string, Map<string, string>>();
  for (const { guildId } of guildEntries) {
    if (!guildChannelConfigCache.has(guildId)) {
      const configs = await listGuildChannelConfigs(env.DB, guildId);
      const m = new Map<string, string>();
      for (const c of configs) {
        m.set(c.winType, c.channelId);
      }
      guildChannelConfigCache.set(guildId, m);
    }
  }

  for (const win of ffaWins) {
    for (const { guildId, discordUserId, channelId } of guildEntries) {
      if (removedGuildIds.has(guildId)) {
        continue;
      }

      try {
        const alreadyPosted = await isFFAGamePosted(
          env.DATA,
          guildId,
          playerId,
          win.gameId,
        );

        if (alreadyPosted) {
          continue;
        }

        if (!gameInfoCache.has(win.gameId)) {
          gameInfoCache.set(
            win.gameId,
            await getGameInfo(win.gameId, { includeTurns: false }),
          );
        }
        const gameInfoData = gameInfoCache.get(win.gameId);

        if (!gameInfoData) {
          console.error(`Game info unavailable for game ${win.gameId}, skipping.`);
          continue;
        }

        const gameInfo = gameInfoData.data.info;
        const isRanked =
          gameInfo.config.rankedType !== null &&
          gameInfo.config.rankedType !== undefined;
        const winType = isRanked ? "ranked" : "ffa";
        const targetChannelId =
          guildChannelConfigCache.get(guildId)?.get(winType) ?? channelId;

        const discordMessage = getFFAWinMessage({
          discordUserId,
          gameId: win.gameId,
          gameInfo,
        });
        const result = await sendChannelMessage(
          env.DISCORD_TOKEN,
          targetChannelId,
          discordMessage,
        );

        if (!result.success && result.discordCode === 50001) {
          if (targetChannelId !== channelId) {
            console.warn(
              `Missing Access for channel override (${winType}) in guild ${guildId}. Removing channel override.`,
            );
            await deleteGuildChannelConfig(env.DB, guildId, winType);
            guildChannelConfigCache.get(guildId)?.delete(winType);
          } else {
            console.warn(
              `Missing Access for player ${discordUserId} in guild ${guildId}. Unregistering player.`,
            );
            await unregisterPlayer(env.DB, guildId, discordUserId);
            removedGuildIds.add(guildId);
          }
          continue;
        }

        if (result.success) {
          await markFFAGamePosted(env.DATA, guildId, playerId, win.gameId);

          const isNotRanked = gameInfo.config.rankedType === undefined;

          if (isNotRanked && gameInfo.winner) {
            const premiumStatus =
              premiumCache.get(guildId) ??
              (await checkPremiumForScheduled(
                env.DB,
                env.DISCORD_TOKEN,
                env.DISCORD_CLIENT_ID,
                env.DISCORD_SKU_ID,
                guildId,
              ));
            premiumCache.set(guildId, premiumStatus);

            if (premiumStatus.isPremium) {
              const guildConfigs = await listGuildConfigsByGuild(
                env.DB,
                guildId,
              );

              if (guildConfigs.length === 0) {
                continue;
              }

              const winnerPlayer = gameInfo.players.find(
                (p) =>
                  p.clientID === gameInfo.winner?.clientID &&
                  guildConfigs.some((c) => c.clanTag === p.clanTag),
              );

              if (winnerPlayer) {
                await recordPlayerWin(
                  env.DB,
                  guildId,
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
          `Error posting FFA win for player ${playerId} in guild ${guildId}:`,
          error,
        );
      }
    }
  }
}
