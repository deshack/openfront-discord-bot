import {
  APIMessageApplicationCommandInteraction,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";
import { deleteMessage } from "../util/discord";
import { unmarkAllFFAGamePosted, unmarkGamePosted } from "../util/kv";
import { deletePlayerWinsByGame } from "../util/stats";

function extractGameId(footerText: string | undefined): string | undefined {
  const match = footerText?.match(/^Game ID: (.+)$/);
  return match?.[1];
}

const command: CommandHandler = {
  data: {
    type: ApplicationCommandType.Message,
    name: "Delete Game Record",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
    dm_permission: false,
  },

  async execute(interaction, env, ctx) {
    const msgInteraction =
      interaction as APIMessageApplicationCommandInteraction;

    const userId =
      msgInteraction.member?.user.id ?? msgInteraction.user?.id;
    if (userId !== env.OWNER_DISCORD_ID) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "You are not authorized to use this command.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const guildId = msgInteraction.guild_id;
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This command can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const targetMessageId = msgInteraction.data.target_id;
    const targetMessage =
      msgInteraction.data.resolved.messages[targetMessageId];
    const gameId = extractGameId(targetMessage.embeds?.[0]?.footer?.text);

    if (!gameId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This message doesn't contain a game record.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const channelId = msgInteraction.channel.id;

    ctx?.waitUntil(
      (async () => {
        await Promise.all([
          unmarkGamePosted(env.DATA, guildId, gameId),
          unmarkAllFFAGamePosted(env.DATA, guildId, gameId),
          deletePlayerWinsByGame(env.DB, guildId, gameId),
        ]);
        await deleteMessage(env.DISCORD_TOKEN, channelId, targetMessageId);
      })(),
    );

    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `Game record for \`${gameId}\` deleted.`,
        flags: MessageFlags.Ephemeral,
      },
    };
  },
};

export default command;
