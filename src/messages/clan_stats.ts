import dedent from "dedent";
import { MessageData } from "../structures/message";
import { getClanStats } from "../util/api_util";

export async function getClanStatsMessage(
  clanTag: string,
): Promise<MessageData | undefined> {
  const clanStats = await getClanStats(clanTag);
  if (clanStats === undefined) {
    return undefined;
  }

  const desc = dedent`
    **Games played**: \`${clanStats.stats.games}\`
    **Total sessions**: \`${clanStats.stats.playerSessions}\`
    **Wins**: \`${clanStats.stats.wins}\` (**Weighted**: \`${clanStats.stats.weightedWins}\`)
    **Losses**: \`${clanStats.stats.losses}\` (**Weighted**: \`${clanStats.stats.weightedLosses}\`)
    **Weighted win-loss-ratio**: \`${clanStats.stats.weightedWLRatio}\`
    `;

  return {
    embeds: [
      {
        title: `[${clanStats.stats.clanTag}] Statistics`,
        description: desc,
        footer: { text: "OpenFront" },
        timestamp: new Date(clanStats.fetchedAt).toISOString(),
        color: 0xffffff,
      },
    ],
  };
}
