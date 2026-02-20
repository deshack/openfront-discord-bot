import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataSubcommandOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { setGuildConfig, getGuildConfig, deleteGuildConfig } from "../util/db";

const command: CommandHandler = {
  data: {
    name: "setup",
    description: "Configure bot settings for this server",
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "wins",
        description: "Configure clan win announcements in this channel",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "tag",
            description: "The clan tag to track",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "disable",
        description: "Disable win announcements for this server",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "status",
        description: "Show current win announcement configuration",
      },
    ],
  },
  async execute(interaction, env) {
    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;
    const options =
      chatInteraction.data
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

    if (subcommand.name === "wins") {
      const tagOption = subcommand.options?.find((o) => o.name === "tag");
      const tag =
        tagOption && "value" in tagOption
          ? String(tagOption.value).trim().toUpperCase()
          : undefined;

      if (!tag) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Clan tag is required",
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

      await setGuildConfig(env.DB, guildId, {
        clanTag: tag,
        channelId,
      });

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Win announcements enabled for clan **[${tag}]** in this channel. The bot will check for new wins every 5 minutes.`,
        },
      };
    }

    if (subcommand.name === "disable") {
      await deleteGuildConfig(env.DB, guildId);

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Win announcements disabled for this server.",
        },
      };
    }

    if (subcommand.name === "status") {
      const config = await getGuildConfig(env.DB, guildId);

      if (!config) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "No win announcements configured for this server. Use `/setup wins <tag>` to enable.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Win announcements are enabled for clan **[${config.clanTag}]** in <#${config.channelId}>.`,
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
  },
};

export default command;
