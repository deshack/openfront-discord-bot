import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataSubcommandOption,
  ApplicationCommandOptionType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import {
  registerPlayer,
  unregisterPlayer,
  getPlayerRegistration,
} from "../util/db";

const command: CommandHandler = {
  data: {
    name: "ffa",
    description: "Register for FFA win announcements",
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "register",
        description: "Register your Player ID for FFA win tracking in this channel",
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
        description: "Stop FFA win announcements",
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "status",
        description: "Check your FFA registration status",
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

    const discordUserId = chatInteraction.member?.user?.id ?? chatInteraction.user?.id;
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
      const playerIdOption = subcommand.options?.find((o) => o.name === "player_id");
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

      await registerPlayer(env.DB, guildId, channelId, discordUserId, playerId);

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Registered for FFA win tracking with Player ID \`${playerId}\`. Your wins will be announced in this channel.`,
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (subcommand.name === "unregister") {
      const removed = await unregisterPlayer(env.DB, guildId, discordUserId);

      if (!removed) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "You are not registered for FFA win tracking in this server.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "FFA win tracking disabled. Your wins will no longer be announced.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    if (subcommand.name === "status") {
      const registration = await getPlayerRegistration(env.DB, guildId, discordUserId);

      if (!registration) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "You are not registered for FFA win tracking. Use `/ffa register <player_id>` to enable.",
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `FFA win tracking is enabled for Player ID \`${registration.playerId}\`. Wins will be announced in <#${registration.channelId}>.`,
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
