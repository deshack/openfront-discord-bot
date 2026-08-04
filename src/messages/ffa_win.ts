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
  clientId: string;
  gameId: string;
  gameInfo?: GameInfo;
  gitCommit?: string;
}

export function getFFAWinMessage(data: FFAWinData): MessageData {
  const { discordUserId, clientId, gameId, gameInfo, gitCommit } = data;

  if (!gameInfo) {
    return {
      content: `<@${discordUserId}> ${gameUrl(gameId)}`,
    };
  }

  const map = gameInfo.config.gameMap;
  const duration = formatDuration(gameInfo.duration);
  const startedAt = dateToDiscordTimestamp(
    gameInfo.start,
    TimestampStyles.RelativeTime,
  );

  const isRanked =
    gameInfo.config.rankedType !== null &&
    gameInfo.config.rankedType !== undefined;
  const title = isRanked
    ? `${gameInfo.config.rankedType} Ranked Win!`
    : "FFA Win!";
  const color = isRanked ? 0x3498db : 0xffd700;

  const usernameFor = (id: string): string =>
    gameInfo.players.find((p) => p.clientID === id)?.username ?? "Unknown";

  const desc =
    gameInfo.winner?.type === "team" && gameInfo.config.rankedType === "2v2"
      ? get2v2Description(
          gameInfo,
          gameId,
          discordUserId,
          clientId,
          map,
          duration,
          startedAt,
          usernameFor,
        )
      : getGenericDescription(
          gameInfo,
          gameId,
          discordUserId,
          map,
          duration,
          startedAt,
          usernameFor,
        );

  return {
    embeds: [
      {
        title,
        description: desc,
        color,
        image: {
          url: mapUrl(map, gitCommit),
        },
        footer: { text: `Game ID: ${gameId}` },
        timestamp: gameInfo.start.toISOString(),
      },
    ],
  };
}

function get2v2Description(
  gameInfo: GameInfo,
  gameId: string,
  discordUserId: string,
  clientId: string,
  map: string,
  duration: string,
  startedAt: string,
  usernameFor: (id: string) => string,
): string {
  const winningIds =
    gameInfo.winner?.type === "team" ? gameInfo.winner.clientIds : [];

  const winners = winningIds.map((id) =>
    id === clientId
      ? `${usernameFor(id)} (<@${discordUserId}>)`
      : usernameFor(id),
  );
  const opponents = gameInfo.players
    .filter((p) => !winningIds.includes(p.clientID))
    .map((p) => p.username);

  return dedent`
    **Map**: ${map}
    **Winners**: ${winners.join(", ")}
    **Opponents**: ${opponents.join(", ")}
    **Duration**: ${duration}
    **Started**: ${startedAt}

    [Watch replay](${gameUrl(gameId)})
    `;
}

function getGenericDescription(
  gameInfo: GameInfo,
  gameId: string,
  discordUserId: string,
  map: string,
  duration: string,
  startedAt: string,
  usernameFor: (id: string) => string,
): string {
  const winnerClientId =
    gameInfo.winner?.type === "team"
      ? gameInfo.winner.clientIds[0]
      : gameInfo.winner?.clientID;
  const winnerUsername =
    winnerClientId !== undefined ? usernameFor(winnerClientId) : "Unknown";
  const showOpponent = gameInfo.config.maxPlayers === 2;

  if (showOpponent) {
    const opponentUsername =
      winnerClientId !== undefined
        ? (gameInfo.players.find((p) => p.clientID !== winnerClientId)
            ?.username ?? "Unknown")
        : "Unknown";

    return dedent`
      **Map**: ${map}
      **Winner**: ${winnerUsername} (<@${discordUserId}>)
      **Opponent**: ${opponentUsername}
      **Duration**: ${duration}
      **Started**: ${startedAt}

      [Watch replay](${gameUrl(gameId)})
      `;
  }

  const totalPlayers = gameInfo.players.filter(
    (player) => player.stats !== null && player.stats !== undefined,
  ).length;

  return dedent`
    **Map**: ${map}
    **Players**: \`${totalPlayers}\`
    **Winner**: ${winnerUsername} (<@${discordUserId}>)
    **Duration**: ${duration}
    **Started**: ${startedAt}

    [Watch replay](${gameUrl(gameId)})
    `;
}
