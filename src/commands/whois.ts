import {
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import {
  getUsernameMappingsByUsernames,
  getUsernamesByDiscordUser,
  stripClanTag,
} from "../util/db";

const EMBED_COLOR = 0x5865f2;
const EMBED_COLOR_NOT_FOUND = 0xff4444;

const command: CommandHandler = {
  data: {
    name: "whois",
    description: "Look up the Discord user for an in-game username, or vice versa",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "username",
        description: "In-game username to look up (clan tag stripped automatically)",
        required: false,
      },
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "Discord user to look up",
        required: false,
      },
    ],
  },
  async execute(interaction, env) {
    const chatInteraction = interaction as APIChatInputApplicationCommandInteraction;
    const guildId = chatInteraction.guild_id;

    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral },
      };
    }

    const options = chatInteraction.data.options ?? [];
    const usernameOption = options.find((o) => o.name === "username") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;
    const userOption = options.find((o) => o.name === "user") as
      | APIApplicationCommandInteractionDataUserOption
      | undefined;

    const hasUsername = usernameOption !== undefined;
    const hasUser = userOption !== undefined;

    if (hasUsername === hasUser) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Please provide exactly one of `username` or `user`.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    // Forward: in-game username → Discord user
    if (hasUsername) {
      const username = stripClanTag(String(usernameOption!.value).trim());
      const mappings = await getUsernameMappingsByUsernames(env.DB, guildId, [username]);
      const discordUserId = mappings.get(username.toLowerCase());

      if (!discordUserId) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [{
              title: "Who Is: Not Found",
              description: `No Discord user is mapped to **${username}**.`,
              color: EMBED_COLOR_NOT_FOUND,
            }],
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [{
            title: "Who Is",
            description: `**${username}** is mapped to <@${discordUserId}>.`,
            color: EMBED_COLOR,
          }],
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    // Reverse: Discord user → in-game usernames
    const discordUserId = String(userOption!.value);
    const usernames = await getUsernamesByDiscordUser(env.DB, guildId, discordUserId);

    if (usernames.length === 0) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [{
            title: "Who Is: Not Found",
            description: `<@${discordUserId}> has no mapped in-game usernames.`,
            color: EMBED_COLOR_NOT_FOUND,
          }],
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const usernameList = usernames.map((u) => `• **${u}**`).join("\n");
    const plural = usernames.length === 1 ? "" : "s";

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [{
          title: "Who Is",
          description: `<@${discordUserId}> is mapped to the following in-game username${plural}:\n\n${usernameList}`,
          color: EMBED_COLOR,
        }],
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
