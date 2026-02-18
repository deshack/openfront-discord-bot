import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { MessageDataWithFiles } from "../structures/message";
import { generateLeaderboardImage, LeaderboardRow } from "../util/image-table";
import {
  getEndOfMonth,
  getLeaderboard,
  isCurrentMonth,
  LeaderboardPeriod,
  MonthContext,
  RankingType,
} from "../util/stats";

const RANK_PAGE_ENTRIES = 25;

export async function getRankMessage(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  page: number,
  monthContext?: MonthContext,
  rankingType: RankingType = "wins",
): Promise<MessageDataWithFiles> {
  const offset = page * RANK_PAGE_ENTRIES;
  const result = await getLeaderboard(
    db,
    guildId,
    period,
    RANK_PAGE_ENTRIES,
    offset,
    monthContext,
    rankingType,
  );

  const totalPages = Math.max(1, Math.ceil(result.totalCount / RANK_PAGE_ENTRIES));
  const isLastPage = page >= totalPages - 1;

  const periodTitle = period === "monthly" ? getMonthName(monthContext) : "All Time";
  const rankingLabel = rankingType === "score" ? "By Score" : "By Wins";
  const title = `Clan Leaderboard - ${periodTitle} · ${rankingLabel}`;

  const hasEntries = result.entries.length > 0;
  let imageBuffer: ArrayBuffer | undefined;
  const timestamp = Date.now();
  const filename = `leaderboard-${timestamp}.png`;

  if (hasEntries) {
    const rows: LeaderboardRow[] = result.entries.map((entry, index) => ({
      rank: offset + index + 1,
      username: entry.username,
      wins: entry.wins,
      teamWins: entry.teamWins,
      ffaWins: entry.ffaWins,
      points: entry.totalScore,
    }));

    imageBuffer = await generateLeaderboardImage(rows);
  }

  let footer: string;
  if (period === "monthly") {
    if (isCurrentMonth(monthContext)) {
      const endOfMonth = getEndOfMonth(monthContext);
      const lastDay = new Date(endOfMonth.getTime() - 1);
      const formatted = lastDay.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      footer = `Season ends ${formatted}`;
    } else {
      footer = "Past season standings";
    }
  } else {
    footer = "All-time standings";
  }

  const year = monthContext?.year ?? 0;
  const month = monthContext?.month ?? 0;

  const backButton = {
    type: ComponentType.Button as const,
    emoji: { name: "\u2b05\ufe0f" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id: page === 0 ? `rank|${period}|${year}|${month}|0|${rankingType}` : `rank|${period}|${year}|${month}|${page - 1}|${rankingType}`,
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
    custom_id: isLastPage ? `rank|${period}|${year}|${month}|${page}|${rankingType}` : `rank|${period}|${year}|${month}|${page + 1}|${rankingType}`,
    disabled: isLastPage,
  };

  const refreshButton = {
    type: ComponentType.Button as const,
    emoji: { name: "🔄" },
    style: ButtonStyle.Secondary as ButtonStyle.Secondary,
    custom_id: `rank-refresh|${period}|${year}|${month}|${page}|${timestamp}|${rankingType}`,
  };

  const embed = hasEntries
    ? {
        title,
        image: { url: `attachment://${filename}` },
        footer: { text: footer },
        color: 0xffd700,
      }
    : {
        title,
        description: "No games recorded yet. Win some games to appear on the leaderboard!",
        footer: { text: footer },
        color: 0xffd700,
      };

  const response: MessageDataWithFiles = {
    message: {
      embeds: [embed],
      components: [
        {
          type: ComponentType.ActionRow,
          components: [backButton, pageButton, nextButton, refreshButton],
        },
      ],
    },
  };

  if (imageBuffer) {
    response.message.attachments = [{ id: "0", filename }];
    response.files = [
      {
        name: filename,
        data: imageBuffer,
        contentType: "image/png",
      },
    ];
  }

  return response;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthName(context?: MonthContext): string {
  const now = new Date();
  const year = context?.year ?? now.getUTCFullYear();
  const month = context?.month ?? now.getUTCMonth() + 1;

  return `${MONTH_NAMES[month - 1]} ${year}`;
}

