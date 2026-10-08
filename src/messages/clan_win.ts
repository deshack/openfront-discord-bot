import dedent from "dedent";
import { MessageData } from "../structures/message";
import { ClanSession } from "../util/api_schemas";
import {
  dateToDiscordTimestamp,
  formatDuration,
  TimestampStyles,
} from "../util/date_format";
import { stripClanTag } from "../util/db";
import { mapUrl, ofStatsReplayUrl, replayUrl } from "../util/openfront";

export interface ClanWinPlayer {
  username: string;
  publicId?: string;
}

export function getClanWinMessage(
  session: ClanSession,
  clanPlayers: ClanWinPlayer[] = [],
  map: string,
  duration?: number,
  publicIdMappings?: Map<string, string>,
  usernameMappings?: Map<string, string>,
  gitCommit?: string,
  mentionOptOuts?: Set<string>,
): MessageData {
  const gameStart = new Date(session.gameStart);

  const resolvedPlayers = clanPlayers.map(({ username, publicId }) => ({
    username,
    discordUserId:
      (publicId && publicIdMappings?.get(publicId)) ??
      usernameMappings?.get(stripClanTag(username).toLowerCase()),
  }));

  const formattedPlayers = resolvedPlayers.map(({ username, discordUserId }) =>
    discordUserId ? `${username} (<@${discordUserId}>)` : username,
  );

  const mentions = [
    ...new Set(
      resolvedPlayers
        .map(({ discordUserId }) => discordUserId)
        .filter((id): id is string => !!id)
        .filter((id) => !mentionOptOuts?.has(id)),
    ),
  ].map((id) => `<@${id}>`);

  const playersLine =
    formattedPlayers.length > 0
      ? `**Players**: ${formattedPlayers.join(", ")}`
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

    [Watch replay](${replayUrl(session.gameId)}) | [Replay on OFStats](${ofStatsReplayUrl(session.gameId)})
    `;

  const mapThumbnailUrl = mapUrl(map, gitCommit);

  console.debug(`Map thumbnail URL for ${map}: ${mapThumbnailUrl}`);

  return {
    ...(mentions.length > 0 && { content: mentions.join(" ") }),
    embeds: [
      {
        title: `[${session.clanTag}] Victory!`,
        description: desc,
        color: 0x00ff00,
        image: {
          url: mapThumbnailUrl,
        },
        footer: { text: `Game ID: ${session.gameId}` },
        timestamp: gameStart.toISOString(),
      },
    ],
  };
}
