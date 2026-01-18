import {
  APIApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  APIMessageComponentInteraction,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import { Env } from "../types/env";
import { handleButton } from "./buttons";
import { handleCommand } from "./commands";

export async function handleInteraction(
  interaction: APIInteraction,
  env: Env,
): Promise<APIInteractionResponse> {
  switch (interaction.type) {
    case InteractionType.ApplicationCommand:
      return handleCommand(
        interaction as APIApplicationCommandInteraction,
        env,
      );

    case InteractionType.MessageComponent:
      return handleButton(interaction as APIMessageComponentInteraction);

    default:
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Unknown interaction type",
          flags: MessageFlags.Ephemeral,
        },
      };
  }
}
