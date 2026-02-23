import {
  ApplicationIntegrationType,
  InteractionContextType,
  InteractionResponseType,
  MessageFlags,
} from "discord-api-types/v10";
import { CommandHandler } from "../structures/command";

const command: CommandHandler = {
  data: {
    name: "help",
    description: "Get help with using the bot",
    integration_types: [ApplicationIntegrationType.GuildInstall],
    contexts: [InteractionContextType.Guild],
  },
  async execute() {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: MessageFlags.Ephemeral,
        embeds: [
          {
            title: "OpenFront Bot Help",
            description: "Here are all available commands:",
            color: 0x5865f2,
            fields: [
              {
                name: "Stats & Lookup",
                value: [
                  "`/info player <id>` — View player info",
                  "`/info clan <tag>` — View clan info",
                  "`/game <game-id>` — Get a link to a game",
                  "`/game-deaths <game-id>` — List deaths in a game",
                ].join("\n"),
              },
              {
                name: "Leaderboards",
                value: [
                  "`/leaderboard players` — Top players",
                  "`/leaderboard clans` — Top clans",
                  "`/rank` — Clan leaderboard rankings *(Premium)*",
                ].join("\n"),
              },
              {
                name: "Personal Tracking",
                value: [
                  "`/ffa register <player_id>` — Register for FFA win announcements",
                  "`/ffa unregister` — Unregister from FFA announcements",
                  "`/ffa status` — Check your registration status",
                ].join("\n"),
              },
              {
                name: "Server Setup *(Admin)*",
                value: [
                  "`/setup wins <channel>` — Set the win announcement channel",
                  "`/setup disable` — Disable win announcements",
                  "`/setup status` — View current bot configuration",
                  "`/in-game-name set <user> <username>` — Map a Discord user to their in-game name",
                  "`/in-game-name remove <username>` — Remove a name mapping",
                  "`/in-game-name list` — List all name mappings",
                  "`/scan-wins` — Backfill player stats from history *(Premium)*",
                ].join("\n"),
              },
              {
                name: "Utility",
                value: "`/ping` — Check bot responsiveness",
              },
            ],
            footer: {
              text: "Commands marked (Admin) require Manage Server permission. Commands marked (Premium) require an active subscription.",
            },
          },
        ],
      },
    };
  },
};

export default command;
