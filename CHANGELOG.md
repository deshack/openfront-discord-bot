# Changelog

## v1.9.0

### New Features

- **Multi-clan-tag subscriptions** — A guild can now subscribe to multiple clan tags, each posting to its own channel. Use `/setup wins <tag>` repeatedly to add tags and `/setup remove <tag>` to remove a single one without disabling all announcements.
- **Per-guild win-type channel routing** — Guild managers can direct non-ranked FFA wins and ranked wins to separate channels via `/setup ffa-channel` and `/setup ranked-channel`. If no override is set, wins continue to post to the player's registration channel.
- **Self-service in-game name linking** — Players can now link their own in-game name with `/in-game-name set <username>` and unlink it with `/in-game-name remove-my-name`, without needing admin help.

### Improvements

- **`/setup status`** now lists all subscribed clan tags with their channels, plus any configured FFA/ranked channel overrides.
- **`/setup disable`** now also clears channel overrides when disabling win announcements.

---

## v1.8.1

### Bug Fixes

- **Filter non-spawned players from clan win embeds** — Players who joined a game but never spawned are no longer listed in clan win announcements.

---

## v1.8.0

### New Features

- **Player ID validation for `/ffa register`** — The bot now rejects inputs that don't match the 8-character alphanumeric Player ID format, with a helpful error message pointing users to the in-game account modal. The success response is now public, announcing to the channel that a user has registered.

### Improvements

- **CloudFlare Queues for win announcements** — Scheduled win handlers now use CloudFlare Queues to avoid hitting CPU limits during processing.
- **Split win queues** — Clan and FFA win announcements are now handled by separate queues, and messages are batched to reduce operations.
- **Message rate limiting** — Each queue run is capped at 4 messages to avoid hitting CloudFlare Queues operations limits.

### Bug Fixes

- **Fix `/ffa` crash on missing channel access** — A Discord error 50001 (missing access) was incorrectly unregistering the guild config instead of the player registration. This is now handled correctly.

---

## v1.7.1

### Improvements

- Added `/whois` to the `/help` command.

---

## v1.7.0

### New Features

- **`/whois` command** — Look up a player by in-game name to find their Discord user, or by Discord user to find their in-game name.

### Improvements

- **Deduplicated API calls** — Shared clan tags and player IDs no longer trigger redundant API requests.
- **Separated cron triggers** — Clan and FFA win handlers now run on independent cron triggers.
- **Extended game session window** — The sessions check window was extended to cover longer games.
- **`/help` command** — New command listing all available bot commands.
- **Broader compatibility** — All commands now declare `integration_types` and `contexts` for use in DMs and non-server contexts.

### Bug Fixes

- **Auto-remove guild config on bot kick** — When the bot loses access to a channel (Discord error 50001), the guild config is now automatically cleaned up.

---

## v1.6.0

### New Features

- **`/game-deaths` command** — Lists players eliminated from a given game.
- **FFA and team wins in `/rank`** — The leaderboard now supports sorting by FFA wins or team wins in addition to score.

### Improvements

- Improved win announcement message formatting.

---

## v1.5.1

### New Features

- **`/game` command** — Get a direct link to an OpenFront game by ID.

### Improvements

- Clan tags are now normalized to uppercase at registration time.
- `/game` is now documented in the help text.

---

## v1.4.1

### Bug Fixes

- Fixed ranked game detection to use `rankedType` instead of player count, preventing clan win announcements from triggering in unranked games.

---

## v1.4.0

### Improvements

- `/rank` now uses a deferred response to avoid timeouts on large leaderboards.
- Rank leaderboard page size increased from 10 to 25.
- Fixed ephemeral error messages in deferred button handlers.
- Fixed duplicate `custom_id` on single-page rank leaderboards.
- Added score-based ranking option to `/rank`.

---

## v1.3.1

### Improvements

- Clan win messages now show full usernames including clan tags.

---

## v1.3.0

### New Features

- **Username-to-Discord mapping for clan win mentions** — Players can link their in-game name to their Discord user so they get mentioned in win announcements.
- **Visual leaderboard** — `/rank` now renders the leaderboard as a canvas image instead of an ASCII table.
- **Monthly leaderboards** — `/rank` accepts optional `year` and `month` parameters to view past leaderboards.
- **Historical win scan** — New scan-wins command to backfill win history from past games.
- **Premium gating** — Commands can be gated behind Discord Monetisation entitlements.

### Improvements

- In-game name set/list responses are now visible to the whole channel.
- Team and FFA wins columns added to the rank leaderboard.

---

## v1.2.0

### New Features

- **FFA win scanning** — The bot now periodically scans for FFA wins and announces them.
- **`/rank` command** — Leaderboard showing player stats for the current clan.
- **Leaderboard refresh button** — Refresh the leaderboard without re-running the command.

---

## v1.1.1

### Bug Fixes

- Fixed game duration formatting.

---

## v1.1.0

### New Features

- **1v1 win announcements** — FFA games with exactly 2 players now use a dedicated win message variant.
- **Rich FFA win embed** — FFA win announcements now use a gold-colored embed including game duration.
- **Game duration in clan win embeds**.

---

## v1.0.0

Initial release.
