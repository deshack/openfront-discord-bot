import {
  APIApplicationCommandInteractionDataStringOption,
  APIApplicationCommandInteractionDataUserOption,
  APIChatInputApplicationCommandInteraction,
  APIEmbed,
  ApplicationCommandOptionType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import {
  getPlayerRegistration,
  getUsernameMappingsByUsernames,
  getUsernamesByDiscordUser,
  listPlayerRegistrationsByGuild,
  PlayerRegistration,
  stripClanTag,
} from "../util/db";

const EMBED_COLOR = 0x5865f2;
const EMBED_COLOR_NOT_FOUND = 0xff4444;

function notFoundEmbed(description: string): APIEmbed {
  return {
    title: "Who Is: Not Found",
    description,
    color: EMBED_COLOR_NOT_FOUND,
  };
}

function foundEmbed(description: string): APIEmbed {
  return {
    title: "Who Is",
    description,
    color: EMBED_COLOR,
  };
}

function normalizeUsername(input: string): string {
  return stripClanTag(input).trim().toLowerCase();
}

function registrationMatchesUsername(
  registration: PlayerRegistration,
  normalizedTarget: string,
): boolean {
  return [registration.profileUsername, registration.lastSeenUsername].some(
    (candidate) =>
      candidate !== null &&
      candidate !== undefined &&
      normalizeUsername(candidate) === normalizedTarget,
  );
}

const command: CommandHandler = {
  data: {
    name: "whois",
    description:
      "Look up the Discord user for an in-game username or Player ID, or vice versa",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "username",
        description:
          "In-game username to look up (checks Player ID registrations first, then legacy name mappings)",
        required: false,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "player_id",
        description: "OpenFront Player ID to look up",
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
    const chatInteraction =
      interaction as APIChatInputApplicationCommandInteraction;
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

    const options = chatInteraction.data.options ?? [];
    const usernameOption = options.find((o) => o.name === "username") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;
    const playerIdOption = options.find((o) => o.name === "player_id") as
      | APIApplicationCommandInteractionDataStringOption
      | undefined;
    const userOption = options.find((o) => o.name === "user") as
      | APIApplicationCommandInteractionDataUserOption
      | undefined;

    const providedCount = [usernameOption, playerIdOption, userOption].filter(
      (o) => o !== undefined,
    ).length;

    if (providedCount !== 1) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content:
            "Please provide exactly one of `username`, `player_id`, or `user`.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    // Forward: in-game username → Discord user
    if (usernameOption) {
      const rawUsername = String(usernameOption.value).trim();
      const normalizedTarget = normalizeUsername(rawUsername);

      const registrations = await listPlayerRegistrationsByGuild(
        env.DB,
        guildId,
      );
      const registration = registrations.find((r) =>
        registrationMatchesUsername(r, normalizedTarget),
      );

      if (registration) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              foundEmbed(
                `**${rawUsername}** is registered with Player ID \`${registration.playerId}\`, mapped to <@${registration.discordUserId}>.`,
              ),
            ],
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      // Fall back to the legacy username mapping table.
      const username = stripClanTag(rawUsername);
      const mappings = await getUsernameMappingsByUsernames(env.DB, guildId, [
        username,
      ]);
      const discordUserId = mappings.get(username.toLowerCase());

      if (!discordUserId) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              notFoundEmbed(
                `No Player ID registration or legacy mapping found for **${rawUsername}**.`,
              ),
            ],
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            foundEmbed(
              `**${username}** is mapped to <@${discordUserId}> *(legacy mapping)*.`,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    // Forward: Player ID → Discord user
    if (playerIdOption) {
      const playerId = String(playerIdOption.value).trim();

      const registrations = await listPlayerRegistrationsByGuild(
        env.DB,
        guildId,
      );
      const registration = registrations.find((r) => r.playerId === playerId);

      if (!registration) {
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            embeds: [
              notFoundEmbed(
                `No player is registered with Player ID \`${playerId}\`.`,
              ),
            ],
            flags: MessageFlags.Ephemeral,
          },
        };
      }

      const username =
        registration.profileUsername ?? registration.lastSeenUsername;
      const usernameSuffix = username ? ` (**${username}**)` : "";

      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            foundEmbed(
              `Player ID \`${playerId}\`${usernameSuffix} is mapped to <@${registration.discordUserId}>.`,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    // Reverse: Discord user → in-game identity
    const discordUserId = String(userOption!.value);

    const [registration, legacyUsernames] = await Promise.all([
      getPlayerRegistration(env.DB, guildId, discordUserId),
      getUsernamesByDiscordUser(env.DB, guildId, discordUserId),
    ]);

    if (!registration && legacyUsernames.length === 0) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [
            notFoundEmbed(
              `<@${discordUserId}> has no Player ID registration or legacy name mappings.`,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const lines: string[] = [];

    if (registration) {
      const username =
        registration.profileUsername ?? registration.lastSeenUsername;
      const usernameSuffix = username ? ` (**${username}**)` : "";
      lines.push(`**Player ID**: \`${registration.playerId}\`${usernameSuffix}`);
    }

    if (legacyUsernames.length > 0) {
      const legacyList = legacyUsernames.map((u) => `• **${u}**`).join("\n");
      lines.push(`**Legacy name mapping${legacyUsernames.length === 1 ? "" : "s"}**:\n${legacyList}`);
    }

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds: [
          foundEmbed(
            `<@${discordUserId}> is mapped to:\n\n${lines.join("\n\n")}`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
