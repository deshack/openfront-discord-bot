# Changelog

## v2.1.1

### Bug Fixes

- **Auto-remove registrations for deleted/invalid Player IDs** — A 404 from the player-sessions API means the Player ID is invalid or the account was deleted, not a transient failure. Previously this was retried forever; now the win-check pipeline and the owner-only historical scan job both delete that player's registration(s) as soon as they see a 404, while other errors (rate limits, upstream 500s) still just skip and retry on the next run.

---

## v2.1.0

### New Features

- **`/player list`** — Admin-only command that lists everyone registered in a server with their username, Player ID, and Discord mention.
- **`/info player` shows the profile username** — Now displays the player's in-game profile username (from the Player API), when they've set one.

### Improvements

- **Automatic username tracking** — A profile username is fetched once at `/player register` time, and a last-seen username is updated from the game-info API whenever any win posts (FFA, ranked, or team), independent of premium status. `/player list` shows whichever is available.
- **`npm run backfill-usernames`** — One-off script to backfill profile usernames for existing registrations. Runs as a plain Node process outside Cloudflare Workers, so it isn't subject to Workers' subrequest/CPU limits.

### Bug Fixes

- **Fixed publicID-based team win matching** — The game-info API's per-player identifier is `publicID`, not `persistentID` as it had been modeled. Reading the wrong key meant it always came back empty, so the publicID-based clan win mentions and stats introduced in v2.0.0 were silently falling back to username matching for every team win. Now reads the correct field.
- **Fixed a crash in `/info player`** — The Player API response no longer includes the `games` array or `user` field the command depended on for its "Recent Games" section; removed that dependency instead of erroring.

---

## v2.0.0

### Breaking Changes

- **`/leaderboard` removed** — The `players` and `clans` subcommands, which only proxied OpenFront's public leaderboard APIs, have been removed. `/rank` (the server's own premium leaderboard) is unaffected.
- **`/ffa` and `/in-game-name set` deprecated** — Both remain registered but now just point users to the new `/player` command instead of performing their old action.

### New Features

- **`/player` command** — Replaces `/ffa` as the generic registration command (`register`/`unregister`/`status`), now used for both FFA and team win tracking.
- **PublicID-based team win matching** — Team game win mentions and the premium `/rank` leaderboard now identify players by their persistent Player ID (publicID) instead of in-game username, matching how FFA already worked. Falls back to the legacy username mapping for players who haven't registered with `/player` yet.
- **"Replay on OFStats" link** — Win embeds and session lists now include a second replay link pointing to OFStats, alongside the primary replay link.

### Improvements

- **Watch replay links now use OpenFront Tools** — Replaces the openfront.io replay link in embeds with OpenFront Tools, which also supports older versions of the game.

---

## v1.14.0

### New Features

- **2v2 ranked win support** — Ranked Team-mode wins (previously filtered out along with all Team-mode games) now post, with a dedicated two-a-side winners/opponents layout for 2v2 and an independent dedupe key per registered teammate.

### Improvements

- **`/trigger-wins` scoped by date range and clan tag** — Replaced the capped days option with an explicit start date (matching `/scan-wins`) and an optional single-clan-tag filter.
- **24-hour API window batching** — Multi-day win scans now split into 24h windows to respect the OpenFront API's one-day max range per request.
- **Configurable OpenFront API headers** — User-Agent and a custom header are now sourced from Cloudflare secrets and only sent when configured, with consistent error logging on non-200 API responses.

### Bug Fixes

- **Fixed `env.DATA` being undefined** — A `wrangler.toml` section-ordering bug (`kv_namespaces` was being parsed under `[vars]`) crashed any code that touched the DATA KV namespace.

---

## v1.13.0

### Bug Fixes

- **Map thumbnails restored** — Switched from OpenFront's asset manifest (blocked by Cloudflare Bot Fight Mode) to GitHub raw content URLs, pinned to the game's commit SHA.

---

## v1.12.0

### Improvements

- **Map thumbnail URLs updated for CDN-hosted assets** — OpenFront moved static assets to content-hashed paths served via ofcdn.dev; thumbnails were resolved from a fetched asset manifest at runtime. *(Superseded in v1.13.0 after Cloudflare Bot Fight Mode started blocking the manifest fetch.)*
- Increased the max queue messages processed per run.

---

## v1.11.0

### New Features

- **"Delete Game Record" context menu command** — Right-click a game win message → Apps → Delete Game Record to clear the KV posted markers, delete the DB ranking rows, and remove the Discord message. Owner only.

### Improvements

- **`/scan-wins` restricted to the bot owner** — Removed the Manage Server/premium gate in favor of an owner-only runtime check, matching `/trigger-wins`.
- **Fixed scan job subrequest limits** — Moved clan-session and player-session fetches into queue consumers (`scan-wins-queue`) and switched to batched DB inserts, keeping scans within Cloudflare's 50-subrequest limit.

### Bug Fixes

- **Skip posting on game info API failures** — Games are now left unposted for retry (with the error logged) instead of posting with "Unknown" map data or a minimal fallback message.

---

## v1.10.1

### Bug Fixes

- **Handle pagination in clan sessions API** — The clan sessions endpoint now returns paginated results. The bot auto-fetches all pages so win counts and session displays remain accurate regardless of result set size.

---

## v1.10.0

### New Features

- **Weekly period for `/rank`** — The `/rank` command now supports a weekly period option.
- **`/trigger-wins` owner command** — Manual cron fallback command for triggering win scans.

---

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
