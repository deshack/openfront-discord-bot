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
  setUsernameMapping,
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
    description: "Map in-game usernames to Discord users for win mentions",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "set",
        description: "Map an in-game username to a Discord user",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "username",
            description:
              "The in-game username (clan tag will be stripped automatically)",
            required: true,
          },
          {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description:
              "The Discord user to map (admin only — omit to set your own name)",
            required: false,
          },
        ],
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
      const userOption = subcommand.options?.find((o) => o.name === "user");
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

      let discordUserId: string;

      if (userOption && "value" in userOption) {
        if (!hasManageGuild(chatInteraction)) {
          return {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content:
                "You need the Manage Server permission to set another user's in-game name.",
              flags: MessageFlags.Ephemeral,
            },
          };
        }

        discordUserId = String(userOption.value);
      } else {
        discordUserId =
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
      }

      const username = stripClanTag(rawUsername);

      await setUsernameMapping(env.DB, guildId, username, discordUserId);

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Mapped in-game username **${username}** to <@${discordUserId}>.`,
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
              "No username mappings configured. Use `/in-game-name set` to add one.",
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
