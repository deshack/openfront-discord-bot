# OpenFront Discord Bot

Discord bot that interacts with the OpenFront API, deployed as a CloudFlare Worker using Discord's HTTP Interactions API.

## Commands

> Commands marked with :star: require a premium subscription. Commands marked with :shield: require the **Manage Server** permission.

### Stats & Lookup

#### `/info player`

Look up a player's profile.

| Option | Required | Description |
|--------|----------|-------------|
| `id` | Yes | The player's Player ID |

#### `/info clan`

Look up a clan's profile.

| Option | Required | Description |
|--------|----------|-------------|
| `tag` | Yes | The clan tag |

#### `/game`

Get a shareable link to an OpenFront game.

| Option | Required | Description |
|--------|----------|-------------|
| `game-id` | Yes | The Game ID |

#### `/game-deaths`

List players who died in a game, ordered by elimination turn.

| Option | Required | Description |
|--------|----------|-------------|
| `game-id` | Yes | The Game ID |

#### `/whois`

Look up the Discord user for an in-game username or Player ID, or the Player ID and in-game names for a Discord user. Provide exactly one of the options.

| Option | Required | Description |
|--------|----------|-------------|
| `username` | No | In-game username (checks Player ID registrations first, then legacy name mappings) |
| `player_id` | No | OpenFront Player ID |
| `user` | No | Discord user |

### Leaderboards

#### `/rank` :star: :shield:

View the clan leaderboard rankings for a given time period.

| Option | Required | Description |
|--------|----------|-------------|
| `period` | No | Time period — `weekly`, `monthly` or `all_time` |
| `year` | No | Year to view (defaults to current year) |
| `month` | No | Month to view, 1–12 (defaults to current month) |
| `week` | No | ISO week number to view, 1–53 (defaults to current week) |
| `type` | No | Ranking method — `wins` (default), `score`, `ffa_wins` or `team_wins` |

### Personal Win Tracking

#### `/player register`

Register a Player ID so the bot announces that player's FFA, ranked and team wins in the current channel and mentions them in win messages. When you register yourself for the first time, the bot asks whether you want to be pinged in win announcements (you can change this later with `/player mentions`).

| Option | Required | Description |
|--------|----------|-------------|
| `player_id` | Yes | OpenFront Player ID, or the full profile URL from the in-game account modal |
| `user` | No | :shield: Register another Discord user instead of yourself |

#### `/player unregister`

Stop win announcements.

| Option | Required | Description |
|--------|----------|-------------|
| `user` | No | :shield: Remove another Discord user's registration instead of your own |

#### `/player status`

Check your registration status and whether you get pinged in win announcements.

#### `/player mentions`

Choose whether you get pinged when your wins are announced. Your wins are still posted either way; opting out only removes the notification.

| Option | Required | Description |
|--------|----------|-------------|
| `enabled` | Yes | `true` to be pinged in win announcements, `false` to opt out |

#### `/player list` :shield:

List all players registered in this server (username, Player ID, Discord user).

#### `/in-game-name remove-my-name`

Remove all your own legacy in-game name mappings.

### Server Setup

All `/setup` subcommands require :shield: **Manage Server**.

#### `/setup wins`

Add a clan tag to win announcements in the current channel.

| Option | Required | Description |
|--------|----------|-------------|
| `tag` | Yes | The clan tag to track |

#### `/setup remove`

Remove a clan tag from win announcements.

| Option | Required | Description |
|--------|----------|-------------|
| `tag` | Yes | The clan tag to remove |

#### `/setup ffa-channel`

Use the current channel for non-ranked FFA win announcements.

#### `/setup ranked-channel`

Use the current channel for ranked win announcements.

#### `/setup disable`

Disable win announcements for this server.

#### `/setup status`

Show the current win announcement configuration.

#### `/in-game-name remove` :shield:

Remove a legacy username-to-Discord mapping.

| Option | Required | Description |
|--------|----------|-------------|
| `username` | Yes | The in-game username to unmap (clan tags are stripped automatically) |

#### `/in-game-name list` :shield:

Show all legacy username mappings for this server.

### Bot Owner

These commands can only be used by the Discord user set in `OWNER_DISCORD_ID`.

#### `/trigger-wins`

Manually run the FFA or clan wins check from a date until now.

| Option | Required | Description |
|--------|----------|-------------|
| `type` | Yes | Which check to run (`ffa` or `clan`) |
| `start_date` | Yes | Start date in YYYY-MM-DD format |
| `clan` | No | Limit the clan wins check to a single clan tag |

#### `/scan-wins`

Backfill player stats from historical wins.

| Option | Required | Description |
|--------|----------|-------------|
| `type` | Yes | Which stats to collect (`clan` or `players`) |
| `start_date` | Yes | Start date in YYYY-MM-DD format |

#### Delete Game Record (message context menu)

Right-click a win announcement → **Apps** → **Delete Game Record** to delete the message and its recorded win.

### Utility

#### `/ping`

Check if the bot is online.

#### `/help`

List all available commands.

### Deprecated

- `/ffa register|unregister|status` — use `/player` instead.
- `/in-game-name set` — use `/player register` instead.

## Prerequisites

- Node.js 20+
- CloudFlare account with Workers enabled
- Discord application (create one in the [Discord Developer Portal](https://discord.com/developers/applications))

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure CloudFlare secrets:
   ```bash
   wrangler secret put DISCORD_TOKEN
   wrangler secret put DISCORD_PUBLIC_KEY
   wrangler secret put DISCORD_CLIENT_ID
   wrangler secret put DISCORD_SKU_ID
   wrangler secret put OWNER_DISCORD_ID
   ```

   Optionally, set `OPENFRONT_USER_AGENT` and `OPENFRONT_CUSTOM_HEADER_VALUE` to send custom headers to the OpenFront API.

3. For local development, copy `.dev.vars.example` to `.dev.vars` and fill in the values.

4. Create the KV namespace, D1 database and queues referenced in `wrangler.toml`, then apply the database migrations:
   ```bash
   wrangler d1 migrations apply openfront-bot-db --remote
   ```

5. Deploy the bot:
   ```bash
   npm run deploy
   ```

6. Register slash commands with Discord:
   ```bash
   export DISCORD_TOKEN=your_token
   export DISCORD_CLIENT_ID=your_client_id
   npm run deploy-commands
   ```

7. In the Discord Developer Portal, set the **Interactions Endpoint URL** to your Worker URL.

## Development

```bash
npm run dev              # Start local development server
npm run deploy           # Deploy to CloudFlare Workers
npm run deploy-commands  # Register slash commands with Discord API
```

## Code Quality

```bash
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking
```

## Testing

```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

## Architecture

The bot runs as a CloudFlare Worker and handles Discord interactions via HTTP (not WebSocket Gateway).

### Request Flow

1. Discord POSTs interaction to the Worker
2. Worker verifies the Ed25519 signature
3. Interaction is routed by type (commands, buttons, etc.)
4. Handler executes and returns API response JSON

Win announcements run in the background: cron triggers every 5 minutes enqueue clan and FFA win checks, which are processed by CloudFlare Queue consumers. Guild configuration and player registrations are stored in D1; posted-game tracking lives in KV.

### Project Structure

```
src/
├── worker.ts          # Entry point - fetch handler
├── handlers/          # Interaction routing, cron and queue handlers
├── commands/          # Slash command definitions
├── messages/          # Message builders (embeds, components)
├── structures/        # Shared interfaces (commands, messages)
├── types/             # TypeScript type definitions
├── util/              # API clients, D1/KV helpers, formatting
└── scripts/           # Utility scripts (deploy commands)
migrations/            # D1 database migrations
```

## License

MIT