import {
  InteractionReplyOptions,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { getClanStatsMessage } from "../../messages/clan_stats";
import { getPlayerPublicMessage } from "../../messages/player_public";
import { CommandHandler } from "../../structures/command";

const command: CommandHandler = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("View info about players and clans")
    .addSubcommand((builder) =>
      builder
        .setName("player")
        .setDescription("View player info")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("The publicID of the player")
            .setRequired(true),
        ),
    )
    .addSubcommand((builder) =>
      builder
        .setName("clan")
        .setDescription("View clan info")
        .addStringOption((option) =>
          option
            .setName("tag")
            .setDescription("The clan tag")
            .setRequired(true),
        ),
    ),
  async execute(interaction) {
    if (!interaction.isChatInputCommand())
      throw new Error("Not a ChatInputCommand");
    const subCommand = interaction.options.getSubcommand(true);
    if (subCommand === "player") {
      const message = await getPlayerPublicMessage(
        interaction.options.getString("id", true).trim(),
      );
      if (message === undefined) {
        interaction.reply({
          content: "Failed to fetch clan stats.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      interaction.reply(message as InteractionReplyOptions);
    } else {
      const message = await getClanStatsMessage(
        interaction.options.getString("tag", true).trim(),
      );
      if (message === undefined) {
        interaction.reply({
          content: "Failed to fetch clan stats.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      interaction.reply(message as InteractionReplyOptions);
    }
  },
};

export default command;
