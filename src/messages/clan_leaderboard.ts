import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import dedent from "dedent";
import { MessageData } from "../structures/message";
import { getClanLeaderboard } from "../util/api_util";
import { dateToDiscordTimestamp, TimestampStyles } from "../util/date_format";

const LEADERBOARD_PAGE_ENTRIES = 5;

export async function getClanLeaderboardMessage(
  page: number,
): Promise<MessageData | undefined> {
  const clanLeaderboardData = await getClanLeaderboard();
  if (clanLeaderboardData === undefined || clanLeaderboardData.data === undefined) {
    return undefined;
  }

  const pageData = clanLeaderboardData.data;
  const fetchedAt = clanLeaderboardData.fetchedAt;
  const originalPageLen = pageData.clans.length;

  const filteredClans = pageData.clans.filter(
    (_value, index) =>
      index >= page * LEADERBOARD_PAGE_ENTRIES &&
      index < page * LEADERBOARD_PAGE_ENTRIES + LEADERBOARD_PAGE_ENTRIES,
  );

  const startDate = new Date(pageData.start);
  const endDate = new Date(pageData.end);
  let str = `Data from ${dateToDiscordTimestamp(
    startDate,
    TimestampStyles.LongDateTime,
  )} to ${dateToDiscordTimestamp(endDate, TimestampStyles.LongDateTime)}\n\n`;

  filteredClans.forEach((entry) => {
    str += dedent`
      **Tag**: \`[${entry.clanTag}]\`
      **Wins**: \`${entry.wins}\` (**Weighted**: \`${entry.weightedWins}\`)
      **Losses**: \`${entry.losses}\` (**Weighted**: \`${entry.weightedLosses}\`)
      **Total games played**: \`${entry.games}\`
      **Total sessions**: \`${entry.playerSessions}\`
      **Weighted win-loss-ratio**: \`${entry.weightedWLRatio}\`
      \n`;
  });

  const isLastPage = (page + 1) * LEADERBOARD_PAGE_ENTRIES >= originalPageLen;

  const backButton = {
    type: ComponentType.Button as const,
    emoji: { name: "⬅️" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id:
      page === 0 ? "clan-lb-view-page-0" : `clan-lb-view-page-${page - 1}`,
    disabled: page === 0,
  };

  const nextButton = {
    type: ComponentType.Button as const,
    emoji: { name: "➡️" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id: isLastPage
      ? `clan-lb-view-page-${page}`
      : `clan-lb-view-page-${page + 1}`,
    disabled: isLastPage,
  };

  const pageButton = {
    type: ComponentType.Button as const,
    label: `${page + 1} / ${Math.ceil(originalPageLen / LEADERBOARD_PAGE_ENTRIES)}`,
    style: ButtonStyle.Secondary as ButtonStyle.Secondary,
    custom_id: "x",
    disabled: true,
  };

  return {
    embeds: [
      {
        title: "Clan Leaderboard",
        description: str,
        footer: { text: "OpenFront" },
        timestamp: new Date(fetchedAt).toISOString(),
        color: 0xffffff,
      },
    ],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [backButton, pageButton, nextButton],
      },
    ],
  };
}
