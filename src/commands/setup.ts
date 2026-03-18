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
  deleteGuildClanTag,
  deleteGuildConfig,
  deleteGuildChannelConfigs,
  listGuildChannelConfigs,
  listGuildConfigsByGuild,
  setGuildChannelConfig,
  setGuildConfig,
} from "../util/db";

const command: CommandHandler = {
  data: {
    name: "setup",
    description: "Configure bot settings for this server",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "wins",
        description: "Add a clan tag to win announcements in this channel",
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
        name: "remove",
        description: "Remove a clan tag from win announcements",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "tag",
            description: "The clan tag to remove",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "ffa-channel",
        description: "Set this channel for non-ranked FFA win announcements",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "ranked-channel",
        description: "Set this channel for ranked FFA win announcements",
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

      await setGuildConfig(env.DB, guildId, {
        clanTag: tag,
        channelId,
      });

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Win announcements enabled for **[${tag}]** in this channel. The bot will check for new wins every 5 minutes.`,
        },
      };
    }

    if (subcommand.name === "remove") {
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

      const removed = await deleteGuildClanTag(env.DB, guildId, tag);

      if (!removed) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `This server is not subscribed to **[${tag}]**.`,
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Removed **[${tag}]** from win announcements.`,
        },
      };
    }

    if (subcommand.name === "ffa-channel") {
      const channelId = chatInteraction.channel?.id;
      if (!channelId) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Could not determine channel",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      await setGuildChannelConfig(env.DB, guildId, "ffa", channelId);

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Non-ranked FFA wins will be posted in this channel.",
        },
      };
    }

    if (subcommand.name === "ranked-channel") {
      const channelId = chatInteraction.channel?.id;
      if (!channelId) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "Could not determine channel",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      await setGuildChannelConfig(env.DB, guildId, "ranked", channelId);

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Ranked FFA wins will be posted in this channel.",
        },
      };
    }

    if (subcommand.name === "disable") {
      await deleteGuildConfig(env.DB, guildId);
      await deleteGuildChannelConfigs(env.DB, guildId);

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Win announcements disabled for this server.",
        },
      };
    }

    if (subcommand.name === "status") {
      const configs = await listGuildConfigsByGuild(env.DB, guildId);
      const channelConfigs = await listGuildChannelConfigs(env.DB, guildId);

      if (configs.length === 0 && channelConfigs.length === 0) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content:
              "No win announcements configured for this server. Use `/setup wins <tag>` to enable.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const lines = configs.map((c) => `**[${c.clanTag}]** → <#${c.channelId}>`);
      let content = `Win announcements are enabled for:\n${lines.join("\n")}`;

      const ffaChannelConfig = channelConfigs.find((c) => c.winType === "ffa");
      const rankedChannelConfig = channelConfigs.find((c) => c.winType === "ranked");

      if (ffaChannelConfig || rankedChannelConfig) {
        content += "\n\n**Channel overrides:**";
        if (ffaChannelConfig) {
          content += `\n**FFA wins channel:** <#${ffaChannelConfig.channelId}>`;
        }
        if (rankedChannelConfig) {
          content += `\n**Ranked wins channel:** <#${rankedChannelConfig.channelId}>`;
        }
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content,
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
