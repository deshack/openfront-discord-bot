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

  const is1v1 = totalPlayers === 2;
  const title = is1v1 ? "1v1 Win!" : "FFA Win!";

  const opponent = is1v1
    ? (winnerClientId != null
        ? gameInfo.players.find((p) => p.clientID !== winnerClientId)
        : undefined)
    : undefined;
  const opponentUsername = opponent?.username ?? "Unknown";

  const desc = is1v1
    ? dedent`
      **Map**: ${map}
      **Winner**: ${winnerUsername} (<@${discordUserId}>)
      **Opponent**: ${opponentUsername}
      **Duration**: ${duration}
      **Started**: ${startedAt}

      [Watch replay](${gameUrl(gameId)})
      `
    : dedent`
      **Map**: ${map}
      **Players**: \`${totalPlayers}\`
      **Winner**: ${winnerUsername} (<@${discordUserId}>)
      **Duration**: ${duration}
      **Started**: ${startedAt}

      [Watch replay](${gameUrl(gameId)})
      `;

  const color = is1v1 ? 0x3498db : 0xffd700;

  return {
    embeds: [
      {
        title,
        description: desc,
        color,
        image: {
          url: mapUrl(map),
        },
        footer: { text: `Game ID: ${gameId}` },
        timestamp: gameInfo.start.toISOString(),
      },
    ],
  };
}
