import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { ChatInputCommand } from "../commands";

export const command = new ChatInputCommand({
  data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),
  async execute(ctx) {
    ctx.reply({ content: "Pong!", flags: MessageFlags.Ephemeral });
  },
});
