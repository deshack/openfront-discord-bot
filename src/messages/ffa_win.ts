import { MessageData } from "../structures/message";
import { gameUrl } from "../util/openfront";

export function getFFAWinMessage(
  discordUserId: string,
  gameId: string,
): MessageData {
  return {
    content: `<@${discordUserId}> ${gameUrl(gameId)}`,
  };
}
