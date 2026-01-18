import dedent from "dedent";
import { MessageData } from "../structures/message";
import { getClanSessions } from "../util/api_util";
import { dateToDiscordTimestamp, TimestampStyles } from "../util/date_format";

const GAME_REPLAY_URL = "https://openfront.io/#join=";
const SESSIONS_LIMIT = 10;

export async function getClanSessionsMessage(
  clanTag: string,
  start?: string,
  end?: string,
): Promise<MessageData | undefined> {
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const effectiveEnd = end ?? now.toISOString();
  const effectiveStart = start ?? twelveHoursAgo.toISOString();

  const sessionsData = await getClanSessions(
    clanTag,
    effectiveStart,
    effectiveEnd,
  );
  if (sessionsData === undefined) {
    return undefined;
  }

  const sessions = sessionsData.data
    .sort(
      (a, b) =>
        new Date(b.gameStart).getTime() - new Date(a.gameStart).getTime(),
    )
    .slice(0, SESSIONS_LIMIT);

  let sessionsStr = "";
  if (sessions.length === 0) {
    sessionsStr = "*(No sessions found)*";
  } else {
    sessions.forEach((session) => {
      const winIndicator = session.hasWon ? "✅" : "❌";
      const gameStart = new Date(session.gameStart);
      sessionsStr += dedent`
        ${winIndicator} **${session.playerTeams}** ${dateToDiscordTimestamp(gameStart, TimestampStyles.RelativeTime)}
            Clan players: \`${session.clanPlayerCount}\` | Total: \`${session.totalPlayerCount}\` | Teams: \`${session.numTeams}\`
            Score: \`${session.score.toFixed(2)}\` | [Watch replay](${GAME_REPLAY_URL}${session.gameId})
        `;
    });
  }

  const startDate = new Date(effectiveStart);
  const endDate = new Date(effectiveEnd);
  const totalSessions = sessionsData.data.length;
  const wins = sessionsData.data.filter((s) => s.hasWon).length;
  const losses = totalSessions - wins;

  const desc = dedent`
    **Period**: ${dateToDiscordTimestamp(startDate, TimestampStyles.ShortDateTime)} to ${dateToDiscordTimestamp(endDate, TimestampStyles.ShortDateTime)}
    **Total sessions**: \`${totalSessions}\` | **Wins**: \`${wins}\` | **Losses**: \`${losses}\`

    **__Recent Sessions__**
    ${sessionsStr}
    `;

  return {
    embeds: [
      {
        title: `[${clanTag}] Sessions`,
        description: desc,
        footer: { text: "OpenFront" },
        timestamp: new Date(sessionsData.fetchedAt).toISOString(),
        color: 0xffffff,
      },
    ],
  };
}
