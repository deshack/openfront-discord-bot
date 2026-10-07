import dedent from "dedent";
import { MessageData } from "../structures/message";
import { GameInfo } from "../util/api_schemas";
import {
  dateToDiscordTimestamp,
  formatDuration,
  TimestampStyles,
} from "../util/date_format";
import {
  gameUrl,
  mapUrl,
  ofStatsReplayUrl,
  replayUrl,
} from "../util/openfront";

export interface FFAWinData {
  discordUserId: string;
  clientId: string;
  gameId: string;
  gameInfo?: GameInfo;
  gitCommit?: string;
  publicIdMappings?: Map<string, string>;
}

export function getFFAWinMessage(data: FFAWinData): MessageData {
  const {
    discordUserId,
    clientId,
    gameId,
    gameInfo,
    gitCommit,
    publicIdMappings,
  } = data;

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

  const discordUserIdFor = (id: string): string | undefined => {
    if (id === clientId) {
      return discordUserId;
    }

    const publicId = gameInfo.players.find((p) => p.clientID === id)?.publicID;

    return publicId ? publicIdMappings?.get(publicId) : undefined;
  };

  const is2v2 =
    gameInfo.winner?.type === "team" && gameInfo.config.rankedType === "2v2";
  const mentionedUserIds = is2v2
    ? getWinningClientIds(gameInfo)
        .map(discordUserIdFor)
        .filter((id): id is string => id !== undefined)
    : [discordUserId];

  const desc = is2v2
    ? get2v2Description(
        gameInfo,
        gameId,
        discordUserIdFor,
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
    content: [...new Set(mentionedUserIds)].map((id) => `<@${id}>`).join(" "),
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

function getWinningClientIds(gameInfo: GameInfo): string[] {
  return gameInfo.winner?.type === "team" ? gameInfo.winner.clientIds : [];
}

function get2v2Description(
  gameInfo: GameInfo,
  gameId: string,
  discordUserIdFor: (id: string) => string | undefined,
  map: string,
  duration: string,
  startedAt: string,
  usernameFor: (id: string) => string,
): string {
  const winningIds = getWinningClientIds(gameInfo);

  const winners = winningIds.map((id) => {
    const winnerDiscordUserId = discordUserIdFor(id);

    return winnerDiscordUserId
      ? `${usernameFor(id)} (<@${winnerDiscordUserId}>)`
      : usernameFor(id);
  });
  const opponents = gameInfo.players
    .filter((p) => !winningIds.includes(p.clientID))
    .map((p) => p.username);

  return dedent`
    **Map**: ${map}
    **Winners**: ${winners.join(", ")}
    **Opponents**: ${opponents.join(", ")}
    **Duration**: ${duration}
    **Started**: ${startedAt}

    [Watch replay](${replayUrl(gameId)}) | [Replay on OFStats](${ofStatsReplayUrl(gameId)})
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

      [Watch replay](${replayUrl(gameId)}) | [Replay on OFStats](${ofStatsReplayUrl(gameId)})
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

    [Watch replay](${replayUrl(gameId)}) | [Replay on OFStats](${ofStatsReplayUrl(gameId)})
    `;
}
