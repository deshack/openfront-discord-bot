import { MessageData } from "../structures/message";
import { GameInfo } from "../util/api_schemas";

export function getGameDeathsMessage(info: GameInfo): MessageData {
  const deadPlayers = info.players
    .filter((p) => p.stats?.killedAt !== undefined)
    .sort((a, b) => Number(b.stats!.killedAt) - Number(a.stats!.killedAt));

  const description =
    deadPlayers.length > 0
      ? deadPlayers
          .map((p) => `**${p.username}** — turn \`${p.stats!.killedAt}\``)
          .join("\n")
      : "No dead players found.";

  return {
    embeds: [
      {
        title: `Deaths — Game ${info.gameID}`,
        description,
        color: 0xff4444,
        footer: { text: `${deadPlayers.length} player(s) eliminated` },
      },
    ],
  };
}
