import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { initClanSessions, initPlayerSessions } from "../util/scan-wins";

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
        name: "type",
        description: "Which stats to collect",
        required: true,
        choices: [
          { name: "Clan", value: "clan" },
          { name: "Players", value: "players" },
        ],
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "start_date",
        description: "Start date (YYYY-MM-DD format, e.g., 2025-11-01)",
        required: true,
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
      (chatInteraction.data
        .options as APIApplicationCommandInteractionDataStringOption[]) ?? [];

    const type = options?.find((o) => o.name === "type")?.value;

    if (!type || !['clan', 'players'].includes(type)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Unknown "type": "${type}"`,
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const startDateOption = options.find((o) => o.name === "start_date");

    const startDateStr = startDateOption?.value;
    const endDateStr = new Date().toISOString().split("T")[0];

    if (!startDateStr || !isValidDateString(startDateStr)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "Invalid start date format. Please use YYYY-MM-DD (e.g., 2025-11-01).",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const startDateIso = `${startDateStr}T00:00:00.000Z`;
    const endDateIso = `${endDateStr}T23:59:59.999Z`;

    const startDate = new Date(startDateIso);
    const endDate = new Date(endDateIso);

    if (startDate > endDate) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Start date cannot be in the future.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const channelId = interaction.channel?.id ?? interaction.channel_id;

    if (!channelId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "Unable to determine the channel for this command. Please try again.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (type === 'clan') {
      await initClanSessions(env.DB, guildId, channelId, startDateIso, endDateIso);
    } else if (type === 'players') {
      const result = await initPlayerSessions(
        env.DB,
        guildId,
        channelId,
        startDateIso,
        endDateIso,
      );

      if (!result.success) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: result.message ?? "Failed to queue player scan.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }
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
