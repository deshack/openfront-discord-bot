import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import dedent from "dedent";
import { MessageData } from "../structures/message";
import { getPublicFFALeaderboard } from "../util/api_util";

const LEADERBOARD_PAGE_ENTRIES = 5;
const LEADERBOARD_MAX_ENTRY = 39;
const LEADERBOARD_MAX_PAGE =
  (LEADERBOARD_MAX_ENTRY + 1) / LEADERBOARD_PAGE_ENTRIES - 1;

export async function getPublicFFALeaderboardMessage(
  page: number,
): Promise<MessageData | undefined> {
  const pageData = await getPublicFFALeaderboard();
  if (pageData === undefined || pageData.data === undefined) {
    return undefined;
  }

  const originalPageLen = pageData.data.length;
  const filteredData = pageData.data.filter(
    (_value, index) =>
      index >= page * LEADERBOARD_PAGE_ENTRIES &&
      index < page * LEADERBOARD_PAGE_ENTRIES + LEADERBOARD_PAGE_ENTRIES,
  );

  let str = "";
  filteredData.forEach((entry) => {
    const userStr =
      entry.user === undefined
        ? undefined
        : `**Discord**: <@${entry.user.id}> (\`@${entry.user.username}\`)\n`;
    str +=
      dedent`
      **PublicId**: \`${entry.public_id}\`
      **Win-Loss-Ratio**: \`${entry.wlr}\`
      **Wins**: \`${entry.wins}\`
      **Losses**: \`${entry.losses}\`
      **Total games played**: \`${entry.total}\`\n
      ` +
      (userStr ?? "*(No Discord account associated)*\n") +
      "\n";
  });

  const backButton = {
    type: ComponentType.Button as const,
    emoji: { name: "⬅️" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id: page === 0 ? "lb-view-page-0" : `lb-view-page-${page - 1}`,
    disabled: page === 0,
  };

  const nextButton = {
    type: ComponentType.Button as const,
    emoji: { name: "➡️" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id:
      page === LEADERBOARD_MAX_PAGE
        ? `lb-view-page-${page}`
        : `lb-view-page-${page + 1}`,
    disabled: page === LEADERBOARD_MAX_PAGE,
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
        title: "Public FFA Leaderboard",
        description: str,
        footer: { text: "OpenFront" },
        timestamp: new Date(pageData.fetchedAt).toISOString(),
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
