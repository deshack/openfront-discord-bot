import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { MessageDataWithFiles } from "../structures/message";
import { generateLeaderboardImage, LeaderboardRow } from "../util/image-table";
import {
  getEndOfMonth,
  getISOWeek,
  getLeaderboard,
  getWeekTimestampRange,
  isCurrentMonth,
  isCurrentWeek,
  LeaderboardPeriod,
  MonthContext,
  RankingType,
  WeekContext,
} from "../util/stats";

const RANK_PAGE_ENTRIES = 25;

export async function getRankMessage(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  page: number,
  monthContext?: MonthContext,
  rankingType: RankingType = "wins",
  weekContext?: WeekContext,
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
    weekContext,
  );

  const totalPages = Math.max(
    1,
    Math.ceil(result.totalCount / RANK_PAGE_ENTRIES),
  );
  const isLastPage = page >= totalPages - 1;

  const periodTitle =
    period === "weekly"
      ? getWeekLabel(weekContext)
      : period === "monthly"
        ? getMonthName(monthContext)
        : "All Time";
  const rankingLabel =
    rankingType === "score"
      ? "By Score"
      : rankingType === "ffa_wins"
        ? "By FFA Wins"
        : rankingType === "team_wins"
          ? "By Team Wins"
          : "By Wins";
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
  if (period === "weekly") {
    if (isCurrentWeek(weekContext)) {
      const { end } = getWeekTimestampRange(weekContext);
      const sunday = new Date((end - 1) * 1000);
      const formatted = sunday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
      footer = `Season ends ${formatted}`;
    } else {
      footer = "Past season standings";
    }
  } else if (period === "monthly") {
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
  const week = weekContext?.week ?? 0;

  const backButton = {
    type: ComponentType.Button as const,
    emoji: { name: "\u2b05\ufe0f" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id:
      page === 0
        ? "rank-back-disabled"
        : `rank|${period}|${year}|${month}|${week}|${page - 1}|${rankingType}`,
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
    custom_id: isLastPage
      ? "rank-next-disabled"
      : `rank|${period}|${year}|${month}|${week}|${page + 1}|${rankingType}`,
    disabled: isLastPage,
  };

  const refreshButton = {
    type: ComponentType.Button as const,
    emoji: { name: "🔄" },
    style: ButtonStyle.Secondary as ButtonStyle.Secondary,
    custom_id: `rank-refresh|${period}|${year}|${month}|${week}|${page}|${timestamp}|${rankingType}`,
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
        description:
          "No games recorded yet. Win some games to appear on the leaderboard!",
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getMonthName(context?: MonthContext): string {
  const now = new Date();
  const year = context?.year ?? now.getUTCFullYear();
  const month = context?.month ?? now.getUTCMonth() + 1;

  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function getWeekLabel(context?: WeekContext): string {
  const { year, week } = context ?? getISOWeek(new Date());
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay();
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - ((dayOfWeek + 6) % 7));
  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return `${fmt(monday)} \u2013 ${fmt(sunday)}, ${sunday.getUTCFullYear()}`;
}
