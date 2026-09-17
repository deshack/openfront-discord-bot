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
  async execute(_interaction, _env) {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        flags: MessageFlags.Ephemeral,
        // Keep in sync with src/commands/index.ts (command registry)
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
                  "`/whois username <name>` — Find the Discord user for an in-game name",
                  "`/whois user <@user>` — Find all in-game names for a Discord user",
                ].join("\n"),
              },
              {
                name: "Leaderboards",
                value: ["`/rank` — Clan leaderboard rankings *(Premium)*"].join(
                  "\n",
                ),
              },
              {
                name: "Personal Tracking",
                value: [
                  "`/player register <player_id>` — Register your Player ID for FFA & team win announcements",
                  "`/player unregister` — Stop win announcements",
                  "`/player status` — Check your registration status",
                  "`/ffa` — *(Deprecated, use `/player` instead)*",
                  "`/in-game-name remove-my-name` — Remove your legacy in-game name link",
                ].join("\n"),
              },
              {
                name: "Server Setup *(Admin)*",
                value: [
                  "`/setup wins <tag>` — Add a clan tag to win announcements",
                  "`/setup remove <tag>` — Remove a clan tag from win announcements",
                  "`/setup ffa-channel` — Set channel for non-ranked FFA win announcements",
                  "`/setup ranked-channel` — Set channel for ranked win announcements",
                  "`/setup disable` — Disable win announcements",
                  "`/setup status` — View current bot configuration",
                  "`/player register <player_id> <user>` — Register another user's Player ID (admin)",
                  "`/player list` — List all registered players (username, Player ID, Discord user)",
                  "`/in-game-name remove <username>` — Remove a legacy name mapping (admin)",
                  "`/in-game-name list` — List legacy name mappings *(Deprecated, win mentions now use `/player`)*",
                ].join("\n"),
              },
              {
                name: "Bot Owner",
                value: [
                  "`/trigger-wins type:<ffa|clan> start_date:<YYYY-MM-DD> [clan]` — Manually trigger wins check from a date to now (optionally for one clan)",
                  "`/scan-wins` — Backfill player stats from history",
                ].join("\n"),
              },
              {
                name: "Utility",
                value: [
                  "`/ping` — Check bot responsiveness",
                  "`/help` — List all available commands",
                ].join("\n"),
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
