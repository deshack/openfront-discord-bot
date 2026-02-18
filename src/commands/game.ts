import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { gameUrl } from "../util/openfront";

const command: CommandHandler = {
  data: {
    name: "game",
    description: "Get the link to an OpenFront game by its ID.",
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

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: gameUrl(gameIdOption!.value),
      },
    };
  },
};

export default command;
