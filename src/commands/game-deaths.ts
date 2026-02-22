import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { getGameInfo } from "../util/api_util";
import { getGameDeathsMessage } from "../messages/game_deaths";

const command: CommandHandler = {
  data: {
    name: "game-deaths",
    description: "List players who died in a game, ordered by elimination turn.",
    options: [
      {
        name: "game-id",
        description: "The Game ID",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  async execute(interaction) {
    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;
    const options = chatInteraction.data.options ?? [];

    const gameIdOption = options.find((o) => o.name === "game-id") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;

    const gameId = gameIdOption?.value.trim();

    if (!gameId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Game ID is required.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const response = await getGameInfo(gameId, { includeTurns: false });

    if (!response) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Failed to fetch game info. Check the game ID and try again.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: getGameDeathsMessage(response.data.info),
    };
  },
};

export default command;
