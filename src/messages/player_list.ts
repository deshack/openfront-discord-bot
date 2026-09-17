import { ButtonStyle, ComponentType, MessageFlags } from "discord-api-types/v10";
import { MessageData } from "../structures/message";
import { listPlayerRegistrationsByGuild } from "../util/db";

const PAGE_SIZE = 15;

export async function getPlayerListMessage(
  db: D1Database,
  guildId: string,
  page: number,
): Promise<MessageData> {
  const registrations = await listPlayerRegistrationsByGuild(db, guildId);

  if (registrations.length === 0) {
    return {
      content: "No players registered. Use `/player register <player_id>` to add one.",
      flags: MessageFlags.Ephemeral,
    };
  }

  const totalPages = Math.max(1, Math.ceil(registrations.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const offset = clampedPage * PAGE_SIZE;
  const pageEntries = registrations.slice(offset, offset + PAGE_SIZE);

  const lines = pageEntries.map((r) => {
    const username = r.profileUsername ?? r.lastSeenUsername ?? "(unknown)";
    return `**${username}** — \`${r.playerId}\` — <@${r.discordUserId}>`;
  });

  const backButton = {
    type: ComponentType.Button as const,
    emoji: { name: "⬅️" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id:
      clampedPage === 0 ? "player-list-disabled" : `player-list|${clampedPage - 1}`,
    disabled: clampedPage === 0,
  };

  const pageButton = {
    type: ComponentType.Button as const,
    label: `${clampedPage + 1} / ${totalPages}`,
    style: ButtonStyle.Secondary as ButtonStyle.Secondary,
    custom_id: "player-list-page-indicator",
    disabled: true,
  };

  const isLastPage = clampedPage >= totalPages - 1;
  const nextButton = {
    type: ComponentType.Button as const,
    emoji: { name: "➡️" },
    style: ButtonStyle.Primary as ButtonStyle.Primary,
    custom_id: isLastPage ? "player-list-disabled" : `player-list|${clampedPage + 1}`,
    disabled: isLastPage,
  };

  return {
    embeds: [
      {
        title: "Registered Players",
        description: lines.join("\n"),
        footer: { text: `${registrations.length} player(s) registered` },
      },
    ],
    components:
      totalPages > 1
        ? [
            {
              type: ComponentType.ActionRow,
              components: [backButton, pageButton, nextButton],
            },
          ]
        : undefined,
    flags: MessageFlags.Ephemeral,
  };
}
