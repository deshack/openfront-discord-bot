import {
  APIApplicationCommandInteraction,
  APIEntitlement,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { commands } from "../commands";
import { premiumRequiredResponse } from "../messages/premium";
import { CommandContext } from "../structures/command";
import { Env } from "../types/env";
import { checkPremium } from "../util/premium";
import { InteractionResponseWithFiles } from "./interaction";

export async function handleCommand(
  interaction: APIApplicationCommandInteraction,
  env: Env,
  ctx?: CommandContext,
): Promise<InteractionResponseWithFiles> {
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

  if (command.requiresPremium) {
    const guildId = interaction.guild_id;
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This command can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const entitlements = (interaction.entitlements ?? []) as APIEntitlement[];
    const premiumStatus = await checkPremium(
      env.DB,
      env.DISCORD_SKU_ID,
      guildId,
      entitlements,
    );

    if (!premiumStatus.isPremium) {
      return premiumRequiredResponse(env.DISCORD_SKU_ID);
    }
  }

  try {
    return await command.execute(interaction, env, ctx);
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
