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
  // eslint-disable-next-line
  const totalPlayers = gameInfo.players.filter((player) => player.stats != null).length;
  const duration = formatDuration(gameInfo.duration);
  const startedAt = dateToDiscordTimestamp(
    gameInfo.start,
    TimestampStyles.RelativeTime,
  );

  const isRanked = gameInfo.config.rankedType !== null && gameInfo.config.rankedType !== undefined;
  const showOpponent = gameInfo.config.maxPlayers === 2;

  const title = isRanked
    ? `${gameInfo.config.rankedType} Ranked Win!`
    : "FFA Win!";

  const opponent = showOpponent
    // eslint-disable-next-line
    ? (winnerClientId != null
        ? gameInfo.players.find((p) => p.clientID !== winnerClientId)
        : undefined)
    : undefined;
  const opponentUsername = opponent?.username ?? "Unknown";

  const desc = showOpponent
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

  const color = isRanked ? 0x3498db : 0xffd700;

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
