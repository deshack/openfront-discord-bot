import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { getClanLeaderboardMessage } from "../messages/clan_leaderboard";
import { getPublicFFALeaderboardMessage } from "../messages/public_ffa_leaderboard";
import { CommandHandler } from "../structures/command";

const command: CommandHandler = {
  data: {
    name: "leaderboard",
    description: "Top players/clans!",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "type",
        description: "Which leaderboard to show",
        required: true,
        choices: [
          { name: "Players", value: "players" },
          { name: "Clans", value: "clans" },
        ],
      },
    ],
  },
  async execute(interaction, env) {
    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;
    const options =
      chatInteraction.data
        .options as APIApplicationCommandInteractionDataStringOption[];
    const typeOption = options?.find((o) => o.name === "type");
    const type = typeOption?.value;

    if (type === "players") {
      const message = await getPublicFFALeaderboardMessage(0);
      if (!message) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Failed to fetch leaderboard",
            flags: MessageFlags.Ephemeral,
          },
        };
      }
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: message,
      };
    }

    if (type === "clans") {
      const message = await getClanLeaderboardMessage(0);
      if (!message) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Failed to fetch leaderboard",
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
        content: `Unknown "type": "${type}"`,
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
