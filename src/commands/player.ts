import {
  APIApplicationCommandInteraction,
  APIApplicationCommandInteractionDataBooleanOption,
  APIApplicationCommandInteractionDataSubcommandOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { getPlayerListMessage } from "../messages/player_list";
import { CommandHandler } from "../structures/command";
import { Env } from "../types/env";
import { getPlayerPublic } from "../util/api_util";
import {
  areGuildMentionsEnabled,
  areMentionsEnabled,
  getPlayerRegistration,
  registerPlayer,
  setMentionsEnabled,
  setProfileUsername,
  unregisterPlayer,
} from "../util/db";
import { backfillPlayerStatsPublicId } from "../util/stats";

const PLAYER_ID_REGEX = /^[a-zA-Z0-9]{8}$/;
const PROFILE_URL_PLAYER_ID_REGEX = /publicID=([a-zA-Z0-9]{8})/;

function extractPlayerId(input: string): string | undefined {
  const trimmed = input.trim();

  if (PLAYER_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(PROFILE_URL_PLAYER_ID_REGEX);

  return match ? match[1] : undefined;
}

function hasManageGuild(
  interaction: APIChatInputApplicationCommandInteraction,
): boolean {
  return (
    (BigInt(interaction.member?.permissions ?? "0") &
      PermissionFlagsBits.ManageGuild) !==
    0n
  );
}

export async function executePlayerCommand(
  interaction: APIApplicationCommandInteraction,
  env: Env,
): Promise<APIInteractionResponse> {
  const chatInteraction =
    interaction as APIChatInputApplicationCommandInteraction;
  const options = chatInteraction.data
    .options as APIApplicationCommandInteractionDataSubcommandOption[];
  const subcommand = options?.[0];

  const guildId = chatInteraction.guild_id;
  if (!guildId) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  if (!subcommand) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "No subcommand provided",
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  const discordUserId =
    chatInteraction.member?.user?.id ?? chatInteraction.user?.id;
  if (!discordUserId) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: "Could not determine user",
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  if (subcommand.name === "register") {
    const playerIdOption = subcommand.options?.find(
      (o) => o.name === "player_id",
    );
    const rawPlayerId =
      playerIdOption && "value" in playerIdOption
        ? String(playerIdOption.value).trim()
        : undefined;

    if (!rawPlayerId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Player ID is required",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const playerId = extractPlayerId(rawPlayerId);

    if (!playerId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "Invalid Player ID format. Your Player ID is an 8-character alphanumeric code, or you can paste your full profile URL from the account modal in-game. Make sure you're not using your in-game name.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const channelId = chatInteraction.channel?.id ?? chatInteraction.channel_id;
    if (!channelId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Could not determine channel",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const userOption = subcommand.options?.find((o) => o.name === "user") as
      | APIApplicationCommandInteractionDataUserOption
      | undefined;

    let targetDiscordUserId = discordUserId;

    if (userOption) {
      if (!hasManageGuild(chatInteraction)) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content:
              "You need the Manage Server permission to register another user's Player ID.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      targetDiscordUserId = String(userOption.value);
    }

    const isNewRegistration =
      targetDiscordUserId === discordUserId &&
      (await getPlayerRegistration(env.DB, guildId, discordUserId)) === null;

    await registerPlayer(
      env.DB,
      guildId,
      channelId,
      targetDiscordUserId,
      playerId,
    );

    try {
      const profile = await getPlayerPublic(playerId, env);
      if (profile?.player.username) {
        await setProfileUsername(env.DB, playerId, profile.player.username);
      }
    } catch (error) {
      console.error(`Failed to fetch profile username for ${playerId}:`, error);
    }

    try {
      await backfillPlayerStatsPublicId(env.DB, guildId, targetDiscordUserId);
    } catch (error) {
      console.error(
        `Failed to backfill player_stats public_id for ${targetDiscordUserId}:`,
        error,
      );
    }

    const content = `<@${targetDiscordUserId}> has registered for win tracking. Their FFA and team wins will be announced in this channel.`;

    if (
      !isNewRegistration ||
      !(await areGuildMentionsEnabled(env.DB, guildId))
    ) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content },
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `${content}\n\n<@${targetDiscordUserId}>, do you want to be pinged when your wins are announced? You can change this anytime with \`/player mentions\`.`,
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                label: "Ping me",
                custom_id: `mentions|on|${targetDiscordUserId}`,
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                label: "Don't ping me",
                custom_id: `mentions|off|${targetDiscordUserId}`,
              },
            ],
          },
        ],
      },
    };
  }

  if (subcommand.name === "unregister") {
    const userOption = subcommand.options?.find((o) => o.name === "user") as
      | APIApplicationCommandInteractionDataUserOption
      | undefined;

    if (userOption) {
      if (!hasManageGuild(chatInteraction)) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content:
              "You need the Manage Server permission to remove another user's registration.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const targetDiscordUserId = String(userOption.value);
      const removed = await unregisterPlayer(
        env.DB,
        guildId,
        targetDiscordUserId,
      );

      if (!removed) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `<@${targetDiscordUserId}> is not registered for win tracking in this server.`,
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Removed <@${targetDiscordUserId}>'s registration. Their wins will no longer be announced.`,
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const removed = await unregisterPlayer(env.DB, guildId, discordUserId);

    if (!removed) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "You are not registered for win tracking in this server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content:
          "Win tracking disabled. Your wins will no longer be announced.",
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  if (subcommand.name === "status") {
    const registration = await getPlayerRegistration(
      env.DB,
      guildId,
      discordUserId,
    );

    if (!registration) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "You are not registered for win tracking. Use `/player register <player_id>` to enable.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const mentionsEnabled = await areMentionsEnabled(
      env.DB,
      guildId,
      discordUserId,
    );
    const guildMentionsEnabled = await areGuildMentionsEnabled(env.DB, guildId);
    const mentionsLine = mentionsEnabled
      ? "You will be pinged when your wins are announced."
      : "You will not be pinged when your wins are announced.";
    const guildMentionsLine = guildMentionsEnabled
      ? ""
      : "\n-# Pings are currently disabled for everyone in this server by its admins.";

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Win tracking is enabled for Player ID \`${registration.playerId}\`. Wins will be announced in <#${registration.channelId}>.\n${mentionsLine} Use \`/player mentions\` to change this.${guildMentionsLine}`,
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  if (subcommand.name === "mentions") {
    const enabledOption = subcommand.options?.find(
      (o) => o.name === "enabled",
    ) as APIApplicationCommandInteractionDataBooleanOption | undefined;

    if (!enabledOption) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "The `enabled` option is required",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    await setMentionsEnabled(
      env.DB,
      guildId,
      discordUserId,
      enabledOption.value,
    );

    const guildMentionsEnabled = await areGuildMentionsEnabled(env.DB, guildId);
    const confirmation = enabledOption.value
      ? "You will be pinged when your wins are announced."
      : "You will no longer be pinged when your wins are announced. Your wins will still be posted.";
    const guildMentionsLine = guildMentionsEnabled
      ? ""
      : "\n-# Pings are currently disabled for everyone in this server by its admins, so you won't be pinged until they turn them back on.";

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `${confirmation}${guildMentionsLine}`,
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  if (subcommand.name === "list") {
    if (!hasManageGuild(chatInteraction)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "You need the Manage Server permission to use this command.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: await getPlayerListMessage(env.DB, guildId, 0),
    };
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `Unknown subcommand: "${subcommand.name}"`,
      flags: MessageFlags.Ephemeral,
    },
  };
}

const command: CommandHandler = {
  data: {
    name: "player",
    description: "Register your Player ID for FFA and team win announcements",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "register",
        description: "Register your Player ID for win tracking in this channel",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "player_id",
            description:
              "Your OpenFront Player ID, or your full profile URL from the account modal",
            required: true,
          },
          {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description:
              "The Discord user to register (admin only — omit to register yourself)",
            required: false,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "unregister",
        description: "Stop win announcements",
        options: [
          {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description:
              "The Discord user to unregister (admin only — omit to unregister yourself)",
            required: false,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "status",
        description: "Check your registration status",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "mentions",
        description:
          "Choose whether you get pinged when your wins are announced",
        options: [
          {
            type: ApplicationCommandOptionType.Boolean,
            name: "enabled",
            description: "Ping me in win announcements",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "list",
        description: "List all players registered in this server (admin only)",
      },
    ],
  },
  execute: executePlayerCommand,
};

export default command;
