import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { MessageData } from "../structures/message";
import {
  getEndOfMonth,
  getLeaderboard,
  isCurrentMonth,
  LeaderboardPeriod,
  MonthContext,
} from "../util/stats";

const RANK_PAGE_ENTRIES = 10;

export async function getRankMessage(
  db: D1Database,
  guildId: string,
  period: LeaderboardPeriod,
  page: number,
  monthContext?: MonthContext,
): Promise<MessageData> {
  const offset = page * RANK_PAGE_ENTRIES;
  const result = await getLeaderboard(
    db,
    guildId,
    period,
    RANK_PAGE_ENTRIES,
    offset,
    monthContext,
  );

  const totalPages = Math.max(1, Math.ceil(result.totalCount / RANK_PAGE_ENTRIES));
  const isLastPage = page >= totalPages - 1;

  const periodTitle = period === "monthly" ? getMonthName(monthContext) : "All Time";
  const title = `Clan Leaderboard - ${periodTitle}`;

  let description: string;
  if (result.entries.length === 0) {
    description = "No games recorded yet. Win some games to appear on the leaderboard!";
  } else {
    description = buildLeaderboardTable(result.entries, offset);
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
    custom_id: page === 0 ? `rank|${period}|${year}|${month}|0` : `rank|${period}|${year}|${month}|${page - 1}`,
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
    custom_id: isLastPage ? `rank|${period}|${year}|${month}|${page}` : `rank|${period}|${year}|${month}|${page + 1}`,
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

interface LeaderboardEntry {
  username: string;
  wins: number;
  totalScore: number;
}

function buildLeaderboardTable(entries: LeaderboardEntry[], offset: number): string {
  const headers = ["#", "Player", "Wins", "Points"];

  const rows = entries.map((entry, index) => {
    const rank = offset + index + 1;
    const medal = getMedal(rank);
    const formattedScore = entry.totalScore.toLocaleString("en-US");

    return {
      rank: `${medal}${medal ? "" : "   "}${rank}`,
      player: entry.username,
      wins: String(entry.wins),
      points: formattedScore,
    };
  });

  const rankWidth = Math.max(headers[0].length, ...rows.map((r) => stripEmoji(r.rank).length));
  const playerWidth = Math.max(headers[1].length, ...rows.map((r) => r.player.length));
  const winsWidth = Math.max(headers[2].length, ...rows.map((r) => r.wins.length));
  const pointsWidth = Math.max(headers[3].length, ...rows.map((r) => r.points.length));

  const headerRow = [
    padRight(headers[0], rankWidth),
    padRight(headers[1], playerWidth),
    padLeft(headers[2], winsWidth),
    padLeft(headers[3], pointsWidth),
  ].join(" │ ");

  const separator = [
    "─".repeat(rankWidth),
    "─".repeat(playerWidth),
    "─".repeat(winsWidth),
    "─".repeat(pointsWidth),
  ].join("─┼─");

  const dataRows = rows.map((row) => {
    const rankDisplay = padRightWithEmoji(row.rank, rankWidth);

    return [
      rankDisplay,
      padRight(row.player, playerWidth),
      padLeft(row.wins, winsWidth),
      padLeft(row.points, pointsWidth),
    ].join(" │ ");
  });

  return "```\n" + [headerRow, separator, ...dataRows].join("\n") + "\n```";
}

function stripEmoji(str: string): string {
  return str.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();
}

function padRight(str: string, width: number): string {
  return str + " ".repeat(Math.max(0, width - str.length));
}

function padLeft(str: string, width: number): string {
  return " ".repeat(Math.max(0, width - str.length)) + str;
}

function padRightWithEmoji(str: string, width: number): string {
  const visibleLength = stripEmoji(str).length;

  return str + " ".repeat(Math.max(0, width - visibleLength));
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
