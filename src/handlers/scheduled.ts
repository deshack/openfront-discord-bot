import { getClanWinMessage } from "../messages/clan_win";
import { Env } from "../types/env";
import { getClanSessions, getGameInfo } from "../util/api_util";
import { sendChannelMessage } from "../util/discord";
import { listGuildConfigs, isGamePosted, markGamePosted } from "../util/kv";

export async function handleScheduled(env: Env): Promise<void> {
  const configs = await listGuildConfigs(env.DATA);

  if (configs.length === 0) {
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

        const gameInfoData = await getGameInfo(win.gameId, { includeTurns: false });

        let clanPlayerUsernames: string[] = [];
        if (gameInfoData) {
          clanPlayerUsernames = gameInfoData.data.info.players
            .filter((player) => player.clanTag === config.clanTag)
            .map((player) => player.username);
        }

        const message = getClanWinMessage(win, clanPlayerUsernames);
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
      console.error(`Error processing guild ${guildId}:`, error);
    }
  }
}
