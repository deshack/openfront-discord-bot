import {
  APIApplicationCommandInteractionDataSubcommandOption,
  APIApplicationCommandInteraction,
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { Env } from "../types/env";
import { getPlayerPublic } from "../util/api_util";
import {
  getPlayerRegistration,
  listPlayerRegistrationsByGuild,
  registerPlayer,
  setProfileUsername,
  unregisterPlayer,
} from "../util/db";

const PLAYER_ID_REGEX = /^[a-zA-Z0-9]{8}$/;

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
    const playerId =
      playerIdOption && "value" in playerIdOption
        ? String(playerIdOption.value).trim()
        : undefined;

    if (!playerId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Player ID is required",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (!PLAYER_ID_REGEX.test(playerId)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "Invalid Player ID format. Your Player ID is an 8-character alphanumeric code. Make sure you're not using your in-game name. You can find your Player ID in the account modal in-game.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const channelId =
      chatInteraction.channel?.id ?? chatInteraction.channel_id;
    if (!channelId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Could not determine channel",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    await registerPlayer(env.DB, guildId, channelId, discordUserId, playerId);

    try {
      const profile = await getPlayerPublic(playerId, env);
      if (profile?.player.username) {
        await setProfileUsername(env.DB, playerId, profile.player.username);
      }
    } catch (error) {
      console.error(`Failed to fetch profile username for ${playerId}:`, error);
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `<@${discordUserId}> has registered for win tracking. Their FFA and team wins will be announced in this channel.`,
      },
    };
  }

  if (subcommand.name === "unregister") {
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
        content: "Win tracking disabled. Your wins will no longer be announced.",
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

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Win tracking is enabled for Player ID \`${registration.playerId}\`. Wins will be announced in <#${registration.channelId}>.`,
        flags: MessageFlags.Ephemeral,
      },
    };
  }

  if (subcommand.name === "list") {
    if (!hasManageGuild(chatInteraction)) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "You need the Manage Server permission to use this command.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const registrations = await listPlayerRegistrationsByGuild(env.DB, guildId);

    if (registrations.length === 0) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "No players registered. Use `/player register <player_id>` to add one.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const lines = registrations.map((r) => {
      const username = r.profileUsername ?? r.lastSeenUsername ?? "(unknown)";
      return `**${username}** — \`${r.playerId}\` — <@${r.discordUserId}>`;
    });

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          {
            title: "Registered Players",
            description: lines.join("\n"),
          },
        ],
        flags: MessageFlags.Ephemeral,
      },
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
        description:
          "Register your Player ID for win tracking in this channel",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "player_id",
            description: "Your OpenFront Player ID",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "unregister",
        description: "Stop win announcements",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "status",
        description: "Check your registration status",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "list",
        description:
          "List all players registered in this server (admin only)",
      },
    ],
  },
  execute: executePlayerCommand,
};

export default command;
