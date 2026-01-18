import {
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";

const command: CommandHandler = {
  data: {
    name: "ping",
    description: "Pong!",
  },
  async execute() {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "Pong!",
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
