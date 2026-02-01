import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { getRankMessage } from "../messages/rank";
import { CommandHandler } from "../structures/command";
import { LeaderboardPeriod } from "../util/stats";

const command: CommandHandler = {
  data: {
    name: "rank",
    description: "View the clan leaderboard rankings",
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "period",
        description: "Time period for rankings",
        required: false,
        choices: [
          { name: "This Month", value: "monthly" },
          { name: "All Time", value: "all_time" },
        ],
      },
    ],
  },
  requiresPremium: true,
  async execute(interaction, env) {
    const guildId = interaction.guild_id;
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This command can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;
    const options =
      (chatInteraction.data.options as APIApplicationCommandInteractionDataStringOption[]) ?? [];
    const periodOption = options.find((o) => o.name === "period");
    const period: LeaderboardPeriod =
      (periodOption?.value as LeaderboardPeriod) ?? "monthly";

    const message = await getRankMessage(env.DB, guildId, period, 0);

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: message,
    };
  },
};

export default command;
