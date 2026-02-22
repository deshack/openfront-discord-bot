import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataIntegerOption,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags, PermissionFlagsBits,
} from "discord-api-types/v10";
import { getRankMessage } from "../messages/rank";
import { CommandHandler } from "../structures/command";
import { patchOriginalResponse } from "../util/discord-webhook";
import { LeaderboardPeriod, MonthContext, RankingType } from "../util/stats";

const command: CommandHandler = {
  data: {
    name: "rank",
    description: "View the clan leaderboard rankings",
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "period",
        description: "Time period for rankings",
        required: false,
        choices: [
          { name: "Month", value: "monthly" },
          { name: "All Time", value: "all_time" },
        ],
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "year",
        description: "Year to view (defaults to current year)",
        required: false,
        min_value: 2020,
        max_value: 2100,
      },
      {
        type: ApplicationCommandOptionType.Integer,
        name: "month",
        description: "Month to view (1-12, defaults to current month)",
        required: false,
        min_value: 1,
        max_value: 12,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "type",
        description: "Ranking method (defaults to by wins)",
        required: false,
        choices: [
          { name: "By Wins", value: "wins" },
          { name: "By Score", value: "score" },
          { name: "By FFA Wins", value: "ffa_wins" },
          { name: "By Team Wins", value: "team_wins" },
        ],
      },
    ],
  },
  requiresPremium: true,
  async execute(interaction, env, ctx) {
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
    const options = chatInteraction.data.options ?? [];

    const periodOption = options.find((o) => o.name === "period") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;
    const yearOption = options.find((o) => o.name === "year") as
      | APIApplicationCommandInteractionDataIntegerOption
      | undefined;
    const monthOption = options.find((o) => o.name === "month") as
      | APIApplicationCommandInteractionDataIntegerOption
      | undefined;
    const typeOption = options.find((o) => o.name === "type") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;

    const period: LeaderboardPeriod =
      (periodOption?.value as LeaderboardPeriod) ?? "all_time";
    const rankingType: RankingType = (typeOption?.value as RankingType) ?? "wins";

    let monthContext: MonthContext | undefined;
    if (period === "monthly" && (yearOption || monthOption)) {
      const now = new Date();
      const year =
        yearOption?.value !== undefined
          ? Number(yearOption.value)
          : now.getUTCFullYear();
      const month =
        monthOption?.value !== undefined
          ? Number(monthOption.value)
          : now.getUTCMonth() + 1;

      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;
      if (
        year > currentYear ||
        (year === currentYear && month > currentMonth)
      ) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Cannot view leaderboard for future months.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      monthContext = { year, month };
    }

    if (!ctx) {
      const result = await getRankMessage(env.DB, guildId, period, 0, monthContext, rankingType);
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: result.message,
        files: result.files,
      };
    }

    ctx.waitUntil(
      (async () => {
        try {
          const result = await getRankMessage(env.DB, guildId, period, 0, monthContext, rankingType);
          await patchOriginalResponse(
            env.DISCORD_CLIENT_ID,
            interaction.token,
            { embeds: result.message.embeds, components: result.message.components, attachments: result.message.attachments },
            result.files,
          );
        } catch (err) {
          console.error("Rank follow-up failed:", err);
          await patchOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
            content: "There was an error while fetching the leaderboard :(",
          });
        }
      })(),
    );

    return { type: InteractionResponseType.DeferredChannelMessageWithSource };
  },
};

export default command;
