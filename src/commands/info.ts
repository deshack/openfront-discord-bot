import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataSubcommandOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { getClanStatsMessage } from "../messages/clan_stats";
import { getPlayerPublicMessage } from "../messages/player_public";
import { CommandHandler } from "../structures/command";

const command: CommandHandler = {
  data: {
    name: "info",
    description: "View info about players and clans",
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "player",
        description: "View player info",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "id",
            description: "The publicID of the player",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "clan",
        description: "View clan info",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "tag",
            description: "The clan tag",
            required: true,
          },
        ],
      },
    ],
  },
  async execute(interaction, env) {
    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;
    const options =
      chatInteraction.data
        .options as APIApplicationCommandInteractionDataSubcommandOption[];
    const subcommand = options?.[0];

    if (!subcommand) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "No subcommand provided",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (subcommand.name === "player") {
      const idOption = subcommand.options?.find((o) => o.name === "id");
      const id =
        idOption && "value" in idOption
          ? String(idOption.value).trim()
          : undefined;

      if (!id) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Player ID is required",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const message = await getPlayerPublicMessage(id);
      if (!message) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Failed to fetch player stats.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: message,
      };
    }

    if (subcommand.name === "clan") {
      const tagOption = subcommand.options?.find((o) => o.name === "tag");
      const tag =
        tagOption && "value" in tagOption
          ? String(tagOption.value).trim()
          : undefined;

      if (!tag) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Clan tag is required",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const message = await getClanStatsMessage(tag);
      if (!message) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Failed to fetch clan stats.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: message,
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Unknown subcommand: "${subcommand.name}"`,
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
