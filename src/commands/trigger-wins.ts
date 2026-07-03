import {
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
import { isValidDateString } from "../util/date_util";

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
        type: ApplicationCommandOptionType.String,
        name: "start_date",
        description:
          "Start date to look back from (YYYY-MM-DD format, e.g., 2025-11-01)",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "clan",
        description: "Limit the clan wins check to a single clan tag",
        required: false,
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

    const typeOption = options.find((o) => o.name === "type") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;
    const startDateOption = options.find((o) => o.name === "start_date") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;
    const clanOption = options.find((o) => o.name === "clan") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;

    const type = typeOption?.value;
    const startDateStr = startDateOption?.value;

    if (!startDateStr || !isValidDateString(startDateStr)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "Invalid start date format. Please use YYYY-MM-DD (e.g., 2025-11-01).",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const now = new Date();

    if (startDate > now) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Start date cannot be in the future.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const hours = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const clanTag = clanOption?.value?.trim().toUpperCase();

    if (type === "clan") {
      await handleClanWins(env, hours, clanTag);
    } else if (type === "ffa") {
      await handleFFAWins(env, hours);
    }

    const clanSuffix = type === "clan" && clanTag ? ` (clan: ${clanTag})` : "";

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Triggered ${type} wins check from ${startDateStr} to now${clanSuffix}.`,
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
