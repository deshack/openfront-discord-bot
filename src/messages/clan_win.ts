import dedent from "dedent";
import { MessageData } from "../structures/message";
import { ClanSession } from "../util/api_schemas";
import {
  dateToDiscordTimestamp,
  formatDuration,
  TimestampStyles,
} from "../util/date_format";
import { gameUrl, mapUrl } from "../util/openfront";

export function getClanWinMessage(
  session: ClanSession,
  clanPlayerUsernames: string[] = [],
  map: string,
  duration?: number,
): MessageData {
  const gameStart = new Date(session.gameStart);

  const playersLine =
    clanPlayerUsernames.length > 0
      ? `**Players**: ${clanPlayerUsernames.join(", ")}`
      : "";

  const durationLine =
    duration !== undefined ? `**Duration**: ${formatDuration(duration)}` : "";

  const desc = dedent`
    **Team**: ${session.playerTeams} (${session.numTeams} teams)
    **Map**: ${map}
    **Clan players**: \`${session.clanPlayerCount}\` / \`${session.totalPlayerCount}\` total
    ${playersLine}
    **Score**: \`${session.score.toFixed(2)}\`
    ${durationLine}
    **Started**: ${dateToDiscordTimestamp(gameStart, TimestampStyles.RelativeTime)}

    [Watch replay](${gameUrl(session.gameId)})
    `;

  return {
    embeds: [
      {
        title: `[${session.clanTag}] Victory!`,
        description: desc,
        color: 0x00ff00,
        image: {
          url: mapUrl(map),
        },
        footer: { text: `Game ID: ${session.gameId}` },
        timestamp: gameStart.toISOString(),
      },
    ],
  };
}
