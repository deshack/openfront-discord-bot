import {
  APIInteractionResponse,
  APIMessageComponentInteraction,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { getClanLeaderboardMessage } from "../messages/clan_leaderboard";
import { getPublicFFALeaderboardMessage } from "../messages/public_ffa_leaderboard";
import { getRankMessage } from "../messages/rank";
import { Env } from "../types/env";
import { LeaderboardPeriod } from "../util/stats";

export async function handleButton(
  interaction: APIMessageComponentInteraction,
  env: Env,
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

  if (customId.startsWith("rank-")) {
    const guildId = interaction.guild_id;
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This feature can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const parts = customId.split("-");
    const period = parts[1] as LeaderboardPeriod;
    const page = parseInt(parts[2]);

    const message = await getRankMessage(env.DB, guildId, period, page);

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
