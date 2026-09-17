import {
  APIInteractionResponse,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { executePlayerCommand } from "./player";

const DEPRECATION_NOTICE =
  "\n\n-# ⚠️ `/ffa` is deprecated — please use `/player` instead. It now covers FFA and team win tracking.";

const command: CommandHandler = {
  data: {
    name: "ffa",
    description: "Deprecated — use /player instead",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "register",
        description: "Deprecated — use /player register instead",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "player_id",
            description: "Your OpenFront Player ID",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "unregister",
        description: "Deprecated — use /player unregister instead",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "status",
        description: "Deprecated — use /player status instead",
      },
    ],
  },
  async execute(interaction, env) {
    const response: APIInteractionResponse = await executePlayerCommand(
      interaction,
      env,
    );

    if (
      response.type === InteractionResponseType.ChannelMessageWithSource &&
      response.data &&
      typeof response.data.content === "string"
    ) {
      response.data.content += DEPRECATION_NOTICE;
    }

    return response;
  },
};

export default command;
