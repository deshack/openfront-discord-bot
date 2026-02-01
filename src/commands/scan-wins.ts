import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { tryCreateScanJob, getGuildConfig } from "../util/db";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) {
    return false;
  }

  const date = new Date(`${dateStr}T00:00:00Z`);

  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

const command: CommandHandler = {
  data: {
    name: "scan-wins",
    description: "Backfill player stats from historical wins (Moderator only)",
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "start_date",
        description: "Start date (YYYY-MM-DD format, e.g., 2025-11-01)",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "end_date",
        description: "End date (YYYY-MM-DD, defaults to now)",
        required: false,
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
      (chatInteraction.data.options as APIApplicationCommandInteractionDataStringOption[]) ??
      [];

    const startDateOption = options.find((o) => o.name === "start_date");
    const endDateOption = options.find((o) => o.name === "end_date");

    const startDateStr = startDateOption?.value;
    const endDateStr = endDateOption?.value ?? new Date().toISOString().split("T")[0];

    if (!startDateStr || !isValidDateString(startDateStr)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Invalid start date format. Please use YYYY-MM-DD (e.g., 2025-11-01).",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (!isValidDateString(endDateStr)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Invalid end date format. Please use YYYY-MM-DD (e.g., 2025-12-31).",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

    if (startDate > endDate) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Start date cannot be after end date.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const guildConfig = await getGuildConfig(env.DB, guildId);
    const clanTag = guildConfig?.clanTag ?? null;
    const channelId = interaction.channel?.id ?? interaction.channel_id;

    if (!channelId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Unable to determine the channel for this command. Please try again.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const jobId = await tryCreateScanJob(
      env.DB,
      guildId,
      channelId,
      clanTag,
      startDate.toISOString(),
      endDate.toISOString(),
    );

    if (jobId === null) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "A scan is already in progress for this server. Please wait for it to complete.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Scan job queued for ${startDateStr} to ${endDateStr}. You'll be notified in this channel when complete.`,
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
