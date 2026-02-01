import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { CommandContext, CommandHandler } from "../structures/command";
import { Env } from "../types/env";
import { getGuildConfig } from "../util/db";
import { scanHistoricalWins } from "../util/scan-wins";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) {
    return false;
  }

  const date = new Date(`${dateStr}T00:00:00Z`);

  return !isNaN(date.getTime()) && date.toISOString().startsWith(dateStr);
}

async function followUp(
  token: string,
  applicationId: string,
  interactionToken: string,
  content: string,
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
}

async function runScan(
  env: Env,
  guildId: string,
  clanTag: string | null,
  startDate: Date,
  endDate: Date,
  startDateStr: string,
  endDateStr: string,
  applicationId: string,
  interactionToken: string,
): Promise<void> {
  try {
    const result = await scanHistoricalWins(
      env.DB,
      guildId,
      clanTag,
      startDate.toISOString(),
      endDate.toISOString(),
    );

    const parts: string[] = [];
    parts.push(`**Scan Complete** (${startDateStr} to ${endDateStr})`);

    if (clanTag) {
      parts.push(
        `**Clan [${clanTag}]:** ${result.clanWinsProcessed} wins processed, ${result.clanPlayersRecorded} player records added`,
      );
    } else {
      parts.push("*No clan configured - skipped clan win scanning*");
    }

    parts.push(
      `**FFA:** ${result.ffaWinsProcessed} wins processed for registered players`,
    );

    const message = parts.join("\n");

    await followUp(env.DISCORD_TOKEN, applicationId, interactionToken, message);
  } catch (error) {
    console.error("Error scanning historical wins:", error);

    await followUp(
      env.DISCORD_TOKEN,
      applicationId,
      interactionToken,
      "An error occurred while scanning historical wins. Please try again later.",
    );
  }
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
  async execute(interaction, env, ctx?: CommandContext) {
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

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

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

    const interactionToken = interaction.token;
    const applicationId = env.DISCORD_CLIENT_ID;

    if (ctx) {
      ctx.waitUntil(
        runScan(
          env,
          guildId,
          clanTag,
          startDate,
          endDate,
          startDateStr,
          endDateStr,
          applicationId,
          interactionToken,
        ),
      );

      return {
        type: InteractionResponseType.DeferredChannelMessageWithSource,
        data: {
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    await runScan(
      env,
      guildId,
      clanTag,
      startDate,
      endDate,
      startDateStr,
      endDateStr,
      applicationId,
      interactionToken,
    );

    return {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: {
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
