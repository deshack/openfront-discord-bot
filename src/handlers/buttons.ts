import {
  APIMessageComponentInteraction,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { getClanLeaderboardMessage } from "../messages/clan_leaderboard";
import { getPublicFFALeaderboardMessage } from "../messages/public_ffa_leaderboard";
import { getRankMessage } from "../messages/rank";
import { CommandContext } from "../structures/command";
import { Env } from "../types/env";
import {
  patchOriginalResponse,
  postFollowupResponse,
} from "../util/discord-webhook";
import {
  LeaderboardPeriod,
  MonthContext,
  RankingType,
  WeekContext,
} from "../util/stats";
import { InteractionResponseWithFiles } from "./interaction";

export async function handleButton(
  interaction: APIMessageComponentInteraction,
  env: Env,
  ctx?: CommandContext,
): Promise<InteractionResponseWithFiles> {
  const customId = interaction.data.custom_id;

  if (customId.startsWith("lb-view-page-")) {
    const page = parseInt(customId.substring("lb-view-page-".length));
    const message = await getPublicFFALeaderboardMessage(page);

    if (!message) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Error fetching leaderboard.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.UpdateMessage,
      data: message,
    };
  }

  if (customId.startsWith("clan-lb-view-page-")) {
    const page = parseInt(customId.substring("clan-lb-view-page-".length));
    const message = await getClanLeaderboardMessage(page);

    if (!message) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "Error fetching leaderboard.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    return {
      type: InteractionResponseType.UpdateMessage,
      data: message,
    };
  }

  if (customId.startsWith("rank-refresh|")) {
    const guildId = interaction.guild_id;
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This feature can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const parts = customId.split("|");
    // New format (8 parts): rank-refresh|period|year|month|week|page|timestamp|rankingType
    // Old format (7 parts): rank-refresh|period|year|month|page|timestamp|rankingType
    const isNewRefreshFormat = parts.length >= 8;
    const period = parts[1] as LeaderboardPeriod;
    const year = parseInt(parts[2]);
    const month = parseInt(parts[3]);
    const week = isNewRefreshFormat ? parseInt(parts[4]) : 0;
    const page = isNewRefreshFormat
      ? parseInt(parts[5]) || 0
      : parseInt(parts[4]) || 0;
    const lastRefresh = isNewRefreshFormat
      ? parseInt(parts[6]) || 0
      : parseInt(parts[5]) || 0;
    const rankingType = isNewRefreshFormat
      ? ((parts[7] as RankingType) || "wins")
      : ((parts[6] as RankingType) || "wins");

    const now = Date.now();
    const cooldownMs = 30 * 1000;
    const remaining = cooldownMs - (now - lastRefresh);

    if (remaining > 0) {
      const secondsLeft = Math.ceil(remaining / 1000);
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `Please wait ${secondsLeft} seconds before refreshing.`,
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    let monthContext: MonthContext | undefined;
    if (period === "monthly" && year > 0 && month > 0) {
      monthContext = { year, month };
    }

    let weekContext: WeekContext | undefined;
    if (period === "weekly" && year > 0 && week > 0) {
      weekContext = { year, week };
    }

    if (!ctx) {
      const result = await getRankMessage(
        env.DB,
        guildId,
        period,
        page,
        monthContext,
        rankingType,
        weekContext,
      );
      return {
        type: InteractionResponseType.UpdateMessage,
        data: result.message,
        files: result.files,
      };
    }

    ctx.waitUntil(
      (async () => {
        try {
          const result = await getRankMessage(
            env.DB,
            guildId,
            period,
            page,
            monthContext,
            rankingType,
            weekContext,
          );
          await patchOriginalResponse(
            env.DISCORD_CLIENT_ID,
            interaction.token,
            {
              embeds: result.message.embeds,
              components: result.message.components,
              attachments: result.message.attachments,
            },
            result.files,
          );
        } catch (err) {
          console.error("Rank refresh follow-up failed:", err);
          await postFollowupResponse(env.DISCORD_CLIENT_ID, interaction.token, {
            content: "There was an error while refreshing the leaderboard :(",
            flags: MessageFlags.Ephemeral,
          });
        }
      })(),
    );

    return { type: InteractionResponseType.DeferredMessageUpdate };
  }

  if (customId.startsWith("rank|")) {
    const guildId = interaction.guild_id;
    if (!guildId) {
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: "This feature can only be used in a server.",
          flags: MessageFlags.Ephemeral,
        },
      };
    }

    const parts = customId.split("|");
    // New format (7 parts): rank|period|year|month|week|page|rankingType
    // Old format (6 parts): rank|period|year|month|page|rankingType
    const isNewPaginationFormat = parts.length >= 7;
    const period = parts[1] as LeaderboardPeriod;
    const year = parseInt(parts[2]);
    const month = parseInt(parts[3]);
    const week = isNewPaginationFormat ? parseInt(parts[4]) : 0;
    const page = isNewPaginationFormat
      ? parseInt(parts[5]) || 0
      : parseInt(parts[4]) || 0;
    const rankingType = isNewPaginationFormat
      ? ((parts[6] as RankingType) || "wins")
      : ((parts[5] as RankingType) || "wins");

    let monthContext: MonthContext | undefined;
    if (period === "monthly" && year > 0 && month > 0) {
      monthContext = { year, month };
    }

    let weekContext: WeekContext | undefined;
    if (period === "weekly" && year > 0 && week > 0) {
      weekContext = { year, week };
    }

    if (!ctx) {
      const result = await getRankMessage(
        env.DB,
        guildId,
        period,
        page,
        monthContext,
        rankingType,
        weekContext,
      );
      return {
        type: InteractionResponseType.UpdateMessage,
        data: result.message,
        files: result.files,
      };
    }

    ctx.waitUntil(
      (async () => {
        try {
          const result = await getRankMessage(
            env.DB,
            guildId,
            period,
            page,
            monthContext,
            rankingType,
            weekContext,
          );
          await patchOriginalResponse(
            env.DISCORD_CLIENT_ID,
            interaction.token,
            {
              embeds: result.message.embeds,
              components: result.message.components,
              attachments: result.message.attachments,
            },
            result.files,
          );
        } catch (err) {
          console.error("Rank pagination follow-up failed:", err);
          await postFollowupResponse(env.DISCORD_CLIENT_ID, interaction.token, {
            content:
              "There was an error while fetching the leaderboard page :(",
            flags: MessageFlags.Ephemeral,
          });
        }
      })(),
    );

    return { type: InteractionResponseType.DeferredMessageUpdate };
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: "Unknown button.",
      flags: MessageFlags.Ephemeral,
    },
  };
}
