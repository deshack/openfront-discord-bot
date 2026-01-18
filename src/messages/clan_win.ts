import dedent from "dedent";
import { MessageData } from "../structures/message";
import { ClanSession } from "../util/api_schemas";
import { dateToDiscordTimestamp, TimestampStyles } from "../util/date_format";

const GAME_REPLAY_URL = "https://openfront.io/#join=";

export function getClanWinMessage(session: ClanSession): MessageData {
  const gameStart = new Date(session.gameStart);

  const desc = dedent`
    **Team**: ${session.playerTeams} (${session.numTeams} teams)
    **Clan players**: \`${session.clanPlayerCount}\` / \`${session.totalPlayerCount}\` total
    **Score**: \`${session.score.toFixed(2)}\`
    **Started**: ${dateToDiscordTimestamp(gameStart, TimestampStyles.RelativeTime)}

    [Watch replay](${GAME_REPLAY_URL}${session.gameId})
    `;

  return {
    embeds: [
      {
        title: `[${session.clanTag}] Victory!`,
        description: desc,
        color: 0x00ff00,
        footer: { text: `Game ID: ${session.gameId}` },
        timestamp: gameStart.toISOString(),
      },
    ],
  };
}
