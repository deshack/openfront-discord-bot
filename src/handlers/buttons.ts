import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { getClanLeaderboardMessage } from "../messages/clan_leaderboard";
import { getPublicFFALeaderboardMessage } from "../messages/public_ffa_leaderboard";

export async function handleButton(
  interaction: APIMessageComponentInteraction,
): Promise<APIInteractionResponse> {
  const customId = interaction.data.custom_id;

  if (customId.startsWith("lb-view-page-")) {
    const page = parseInt(customId.substring("lb-view-page-".length));
    const message = await getPublicFFALeaderboardMessage(page);

    if (!message) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Error fetching leaderboard.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.UpdateMessage,
      data: message,
    };
  }

  if (customId.startsWith("clan-lb-view-page-")) {
    const page = parseInt(customId.substring("clan-lb-view-page-".length));
    const message = await getClanLeaderboardMessage(page);

    if (!message) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Error fetching leaderboard.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.UpdateMessage,
      data: message,
    };
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "Unknown button.",
      flags: MessageFlags.Ephemeral,
    },
  };
}
