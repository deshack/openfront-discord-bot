import {
  APIApplicationCommandInteractionDataIntegerOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { handleClanWins, handleFFAWins } from "../handlers/scheduled";
import { CommandHandler } from "../structures/command";

function isOwner(
  interaction: APIChatInputApplicationCommandInteraction,
  ownerDiscordId: string,
): boolean {
  const userId = interaction.member?.user.id ?? interaction.user?.id;

  return userId === ownerDiscordId;
}

const command: CommandHandler = {
  data: {
    name: "trigger-wins",
    description: "Manually trigger FFA or Clan wins check (bot owner only)",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "type",
        description: "Which wins check to trigger",
        required: true,
        choices: [
          { name: "FFA", value: "ffa" },
          { name: "Clan", value: "clan" },
        ],
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "hours",
        description: "Hours to look back (default: 2)",
        required: false,
        min_value: 1,
        max_value: 168,
      },
    ],
  },

  async execute(interaction, env) {
    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;

    if (!isOwner(chatInteraction, env.OWNER_DISCORD_ID)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "You are not authorized to use this command.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const options = chatInteraction.data.options ?? [];

    const typeOption = options.find(
      (o) => o.name === "type",
    ) as APIApplicationCommandInteractionDataStringOption | undefined;
    const hoursOption = options.find(
      (o) => o.name === "hours",
    ) as APIApplicationCommandInteractionDataIntegerOption | undefined;

    const type = typeOption?.value;
    const hours = (hoursOption?.value as number | undefined) ?? 2;

    if (type === "clan") {
      await handleClanWins(env, hours);
    } else if (type === "ffa") {
      await handleFFAWins(env, hours);
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Triggered ${type} wins check for the last ${hours} hour(s).`,
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
