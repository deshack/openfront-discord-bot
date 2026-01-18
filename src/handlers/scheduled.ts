import { getClanWinMessage } from "../messages/clan_win";
import { Env } from "../types/env";
import { getClanSessions } from "../util/api_util";
import { sendChannelMessage } from "../util/discord";
import { listGuildConfigs, isGamePosted, markGamePosted } from "../util/kv";

export async function handleScheduled(env: Env): Promise<void> {
  const configs = await listGuildConfigs(env.DATA);

  if (configs.length === 0) {
    return;
  }

  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const start = fifteenMinutesAgo.toISOString();
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

        const message = getClanWinMessage(win);
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
