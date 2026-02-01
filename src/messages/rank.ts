import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { MessageData } from "../structures/message";
import {
  getEndOfCurrentMonth,
  getLeaderboard,
  LeaderboardPeriod,
} from "../util/stats";
import { dateToDiscordTimestamp, TimestampStyles } from "../util/date_format";

const RANK_PAGE_ENTRIES = 10;

export async function getRankMessage(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  page: number,
): Promise<MessageData> {
  const offset = page * RANK_PAGE_ENTRIES;
  const result = await getLeaderboard(
    db,
    guildId,
    period,
    RANK_PAGE_ENTRIES,
    offset,
  );

  const totalPages = Math.max(1, Math.ceil(result.totalCount / RANK_PAGE_ENTRIES));
  const isLastPage = page >= totalPages - 1;

  const periodTitle = period === "monthly" ? getCurrentMonthName() : "All Time";
  const title = `Clan Leaderboard - ${periodTitle}`;

  let description: string;
  if (result.entries.length === 0) {
    description = "No games recorded yet. Win some games to appear on the leaderboard!";
  } else {
    description = result.entries
      .map((entry, index) => {
        const rank = offset + index + 1;
        const medal = getMedal(rank);
        const formattedScore = entry.totalScore.toLocaleString("en-US");

        return `${medal}**#${rank}** ${entry.username} - ${entry.wins} win${entry.wins === 1 ? "" : "s"} (${formattedScore} pts)`;
      })
      .join("\n");
  }

  let footer: string;
  if (period === "monthly") {
    const endOfMonth = getEndOfCurrentMonth();
    const timestamp = dateToDiscordTimestamp(endOfMonth, TimestampStyles.RelativeTime);
    footer = `Season ends ${timestamp}`;
  } else {
    footer = "All-time standings";
  }

  const backButton = {
    type: ComponentType.Button as const,
    emoji: { name: "\u2b05\ufe0f" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id: page === 0 ? `rank-${period}-0` : `rank-${period}-${page - 1}`,
    disabled: page === 0,
  };

  const pageButton = {
    type: ComponentType.Button as const,
    label: `${page + 1} / ${totalPages}`,
    style: ButtonStyle.Secondary as ButtonStyle.Secondary,
    custom_id: "rank-page-indicator",
    disabled: true,
  };

  const nextButton = {
    type: ComponentType.Button as const,
    emoji: { name: "\u27a1\ufe0f" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id: isLastPage ? `rank-${period}-${page}` : `rank-${period}-${page + 1}`,
    disabled: isLastPage,
  };

  return {
    embeds: [
      {
        title,
        description,
        footer: { text: footer },
        color: 0xffd700,
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

function getCurrentMonthName(): string {
  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

function getMedal(rank: number): string {
  switch (rank) {
    case 1:
      return "\ud83e\udd47 ";
    case 2:
      return "\ud83e\udd48 ";
    case 3:
      return "\ud83e\udd49 ";
    default:
      return "";
  }
}
