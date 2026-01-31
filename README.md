# OpenFront Discord Bot

Discord bot that interacts with the OpenFront API, deployed as a CloudFlare Worker using Discord's HTTP Interactions API.

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