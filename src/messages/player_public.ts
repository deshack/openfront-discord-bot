import dedent from "dedent";
import { MessageData } from "../structures/message";
import { GameDifficulty, GameMode } from "../util/api_schemas";
import { getPlayerPublic } from "../util/api_util";
import { dateToDiscordTimestamp, TimestampStyles } from "../util/date_format";

const RECENT_GAMES_LEN = 5;
const GAME_REPLAY_URL = "https://openfront.io/#join=";

export async function getPlayerPublicMessage(
  publicId: string,
): Promise<MessageData | undefined> {
  const playerPublic = await getPlayerPublic(publicId);
  if (playerPublic === undefined) {
    return undefined;
  }

  const recentGames = playerPublic.player.games
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .filter((_value, index) => index < RECENT_GAMES_LEN);

  let recentGamesStr = "";
  recentGames.forEach((game) => {
    recentGamesStr += dedent`
        \n**${game.gameId}** ${dateToDiscordTimestamp(
          game.start,
          TimestampStyles.RelativeTime,
        )}
            ${game.mode} - ${game.difficulty} - ${game.map} - ${game.type}
            [Watch replay](${GAME_REPLAY_URL}${game.gameId})
        `;
  });

  let statisticsStr = "";
  if (playerPublic.player.stats.Public !== undefined) {
    const publicStats = playerPublic.player.stats.Public;
    for (const gameModeKey in publicStats) {
      if (publicStats[gameModeKey] !== undefined) {
        const stat = publicStats[gameModeKey as GameMode];
        const summary: {
          wins: number;
          losses: number;
          total: number;
        } = {
          wins: 0,
          losses: 0,
          total: 0,
        };
        for (const key in stat) {
          const entry = stat[key as GameDifficulty];
          if (entry === undefined) continue;
          summary.wins += entry.wins ?? 0;
          summary.losses += entry.losses ?? 0;
          summary.total += entry.total ?? 0;
        }
        statisticsStr += dedent`
                \n**${gameModeKey} (summary)**
                __Wins__: \`${summary.wins}\`
                __Losses__: \`${summary.losses}\`
                __Total__: \`${summary.total}\`
            `;
      }
    }
  } else {
    statisticsStr = "*(No data to show)*";
  }

  const str = dedent`
        **PublicID**: ||\`${publicId}\`||
        **Created**: ${
          playerPublic.player.createdAt === undefined
            ? "*(No data)*"
            : dateToDiscordTimestamp(
                playerPublic.player.createdAt,
                TimestampStyles.RelativeTime,
              )
        }

        **__Recent Games__**
        ${recentGamesStr}

        **__Statistics__**
        ${statisticsStr}
    `;

  return {
    embeds: [
      {
        title: "Player summary",
        description: str,
        timestamp: new Date(playerPublic.fetchedAt).toISOString(),
        color: 0xffffff,
        footer: { text: "OpenFront" },
      },
    ],
  };
}
