import dedent from "dedent";
import { MessageData } from "../structures/message";
import { GameInfo } from "../util/api_schemas";
import {
  dateToDiscordTimestamp,
  formatDuration,
  TimestampStyles,
} from "../util/date_format";
import { gameUrl, mapUrl } from "../util/openfront";

export interface FFAWinData {
  discordUserId: string;
  gameId: string;
  gameInfo?: GameInfo;
}

export function getFFAWinMessage(data: FFAWinData): MessageData {
  const { discordUserId, gameId, gameInfo } = data;

  if (!gameInfo) {
    return {
      content: `<@${discordUserId}> ${gameUrl(gameId)}`,
    };
  }

  const winnerClientId = gameInfo.winner?.clientID;
  const winnerPlayer = gameInfo.players.find(
    (player) => player.clientID === winnerClientId,
  );
  const winnerUsername = winnerPlayer?.username ?? "Unknown";

  const map = gameInfo.config.gameMap;
  const totalPlayers = gameInfo.players.length;
  const duration = formatDuration(gameInfo.duration);
  const startedAt = dateToDiscordTimestamp(
    gameInfo.start,
    TimestampStyles.RelativeTime,
  );

  const desc = dedent`
    **Map**: ${map}
    **Players**: \`${totalPlayers}\`
    **Winner**: ${winnerUsername} (<@${discordUserId}>)
    **Duration**: ${duration}
    **Started**: ${startedAt}

    [Watch replay](${gameUrl(gameId)})
    `;

  return {
    embeds: [
      {
        title: "FFA Win!",
        description: desc,
        color: 0xffd700,
        image: {
          url: mapUrl(map),
        },
        footer: { text: `Game ID: ${gameId}` },
        timestamp: gameInfo.start.toISOString(),
      },
    ],
  };
}
