import {
  APIApplicationCommandInteraction,
  APIInteractionResponse,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { commands } from "../commands";
import { Env } from "../types/env";

export async function handleCommand(
  interaction: APIApplicationCommandInteraction,
  env: Env,
): Promise<APIInteractionResponse> {
  const commandName = interaction.data.name;
  const command = commands[commandName as keyof typeof commands];

  if (!command) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Unknown command: ${commandName}`,
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  try {
    return await command.execute(interaction, env);
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "There was an error while executing this command :(",
        flags: MessageFlags.Ephemeral,
      },
    };
  }
}
