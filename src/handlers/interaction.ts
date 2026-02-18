import {
  APIApplicationCommandInteraction,
  APIInteraction,
  APIInteractionResponse,
  APIMessageComponentInteraction,
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandContext } from "../structures/command";
import { Env } from "../types/env";
import { FileAttachment } from "../util/multipart";
import { handleButton } from "./buttons";
import { handleCommand } from "./commands";

export type InteractionResponseWithFiles = APIInteractionResponse & {
  files?: FileAttachment[];
};

export async function handleInteraction(
  interaction: APIInteraction,
  env: Env,
  ctx?: CommandContext,
): Promise<InteractionResponseWithFiles> {
  switch (interaction.type) {
    case InteractionType.ApplicationCommand:
      return handleCommand(
        interaction as APIApplicationCommandInteraction,
        env,
        ctx,
      );

    case InteractionType.MessageComponent:
      return handleButton(interaction as APIMessageComponentInteraction, env, ctx);

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
