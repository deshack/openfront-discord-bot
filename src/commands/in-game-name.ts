import {
  APIApplicationCommandInteractionDataSubcommandOption,
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import {
  getUsernameMappings,
  removeUsernameMapping,
  removeUsernameMappingsByDiscordUser,
  stripClanTag,
} from "../util/db";

function hasManageGuild(
  interaction: APIChatInputApplicationCommandInteraction,
): boolean {
  return (
    (BigInt(interaction.member?.permissions ?? "0") &
      PermissionFlagsBits.ManageGuild) !==
    0n
  );
}

const command: CommandHandler = {
  data: {
    name: "in-game-name",
    description:
      "Deprecated — win mentions now use /player. Manage legacy username mappings",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "set",
        description: "Deprecated — use /player register instead",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "remove",
        description: "Remove a username mapping (admin only)",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "username",
            description:
              "The in-game username to unmap (clan tag will be stripped automatically)",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "remove-my-name",
        description: "Remove all your own in-game name mappings",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "list",
        description: "Show all username mappings for this server (admin only)",
      },
    ],
  },
  async execute(interaction, env) {
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
          content: "No subcommand provided.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (subcommand.name === "set") {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "`/in-game-name set` is deprecated. Team game matching and win mentions now use your Player ID. Use `/player register <player_id>` instead.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (subcommand.name === "remove") {
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

      const usernameOption = subcommand.options?.find(
        (o) => o.name === "username",
      );
      const rawUsername =
        usernameOption && "value" in usernameOption
          ? String(usernameOption.value).trim()
          : undefined;

      if (!rawUsername) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Username is required.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const username = stripClanTag(rawUsername);
      const removed = await removeUsernameMapping(env.DB, guildId, username);

      if (!removed) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `No mapping found for **${username}**.`,
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Removed mapping for **${username}**.`,
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (subcommand.name === "remove-my-name") {
      const discordUserId =
        chatInteraction.member?.user.id ?? chatInteraction.user?.id ?? "";

      if (!discordUserId) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Could not determine your Discord user ID.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const count = await removeUsernameMappingsByDiscordUser(
        env.DB,
        guildId,
        discordUserId,
      );

      if (count === 0) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "You have no in-game name mappings to remove.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Removed ${count} in-game name mapping${count === 1 ? "" : "s"} for your account.`,
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

      const mappings = await getUsernameMappings(env.DB, guildId);

      if (mappings.size === 0) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content:
              "No username mappings configured. Use `/player register <player_id>` for new win tracking.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const lines = Array.from(mappings.entries()).map(
        ([username, discordUserId]) => `**${username}** → <@${discordUserId}>`,
      );

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            {
              title: "Username Mappings",
              description: lines.join("\n"),
            },
          ],
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
  },
};

export default command;
