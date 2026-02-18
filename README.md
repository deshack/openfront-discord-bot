# OpenFront Discord Bot

Discord bot that interacts with the OpenFront API, deployed as a CloudFlare Worker using Discord's HTTP Interactions API.

## Commands

> Commands marked with :star: require a premium subscription.

### `/ping`

Check if the bot is online.

### `/leaderboard`

View the top players or clans.

| Option | Required | Description |
|--------|----------|-------------|
| `type` | Yes | Which leaderboard to show (`players` or `clans`) |

### `/info player`

Look up a player's profile.

| Option | Required | Description |
|--------|----------|-------------|
| `id` | Yes | The player's public ID |

### `/info clan`

Look up a clan's profile.

| Option | Required | Description |
|--------|----------|-------------|
| `tag` | Yes | The clan tag |

### `/rank` :star:

View the clan leaderboard rankings for a given time period.

| Option | Required | Description |
|--------|----------|-------------|
| `period` | No | Time period — `monthly` or `all_time` (default) |
| `year` | No | Year to view (defaults to current year) |
| `month` | No | Month to view, 1–12 (defaults to current month) |
| `type` | No | Ranking method — `wins` (default) or `score` |

### `/game`

Get a shareable link to an OpenFront game. Works in servers and DMs.

| Option | Required | Description |
|--------|----------|-------------|
| `game-id` | Yes | The Game ID |

### `/ffa register`

Register your Player ID so the bot announces your FFA wins in the current channel.

| Option | Required | Description |
|--------|----------|-------------|
| `player_id` | Yes | Your OpenFront Player ID |

### `/ffa unregister`

Stop receiving FFA win announcements.

### `/ffa status`

Check your current FFA registration status.

### `/setup wins`

Enable clan win announcements in the current channel. Requires **Manage Server** permission.

| Option | Required | Description |
|--------|----------|-------------|
| `tag` | Yes | The clan tag to track |

### `/setup disable`

Disable clan win announcements for this server. Requires **Manage Server** permission.

### `/setup status`

Show the current win announcement configuration. Requires **Manage Server** permission.

### `/in-game-name set`

Map an in-game username to a Discord user so they get mentioned in clan win announcements. Requires **Manage Server** permission.

| Option | Required | Description |
|--------|----------|-------------|
| `user` | Yes | The Discord user to mention |
| `username` | Yes | The in-game username (clan tags are stripped automatically) |

### `/in-game-name remove`

Remove a username-to-Discord mapping. Requires **Manage Server** permission.

| Option | Required | Description |
|--------|----------|-------------|
| `username` | Yes | The in-game username to unmap |

### `/in-game-name list`

Show all username mappings for this server. Requires **Manage Server** permission.

### `/scan-wins` :star:

Backfill player stats from historical wins. Requires **Manage Server** permission.

| Option | Required | Description |
|--------|----------|-------------|
| `type` | Yes | Which stats to collect (`clan` or `players`) |
| `start_date` | Yes | Start date in YYYY-MM-DD format |

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
   ```

3. For local development, copy `.dev.vars.example` to `.dev.vars` and fill in the values.

4. Deploy the bot:
   ```bash
   npm run deploy
   ```

5. Register slash commands with Discord:
   ```bash
   export DISCORD_TOKEN=your_token
   export DISCORD_CLIENT_ID=your_client_id
   npm run deploy-commands
   ```

6. In the Discord Developer Portal, set the **Interactions Endpoint URL** to your Worker URL.

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

### Project Structure

```
src/
├── worker.ts          # Entry point - fetch handler
├── handlers/          # Interaction routing by type
├── commands/          # Slash command definitions
├── messages/          # Message builders (embeds, components)
├── types/             # TypeScript type definitions
└── scripts/           # Utility scripts (deploy commands)
```

## License

MIT