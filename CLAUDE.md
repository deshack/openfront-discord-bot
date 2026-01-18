# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start local development server (wrangler dev)
npm run deploy           # Deploy to CloudFlare Workers
npm run deploy-commands  # Register slash commands with Discord API

# Code quality
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking only

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

## Configuration

### CloudFlare Workers Setup

1. Set secrets: `wrangler secret put DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_ID`
2. For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in values

### Discord Setup

After deploying, set the Interactions Endpoint URL in the Discord Developer Portal to your Worker URL.

## Architecture

This is a Discord bot deployed as a CloudFlare Worker using Discord's HTTP Interactions API (not WebSocket Gateway).

### Core Structure

- **Entry point**: `src/worker.ts` - Fetch handler that verifies Discord signatures and routes interactions
- **Handlers**: `src/handlers/` - Interaction routing by type (commands, buttons)
- **Commands**: `src/commands/` - Slash commands with static registry in `index.ts`
- **Messages**: `src/messages/` - Message builders for embeds and components
- **Types**: `src/types/env.ts` - Worker environment bindings (secrets)

### Request Flow

1. Discord POSTs interaction to Worker
2. `src/util/verify.ts` validates Ed25519 signature
3. `src/handlers/interaction.ts` routes by interaction type
4. Commands/buttons execute and return API response JSON
5. API data fetched fresh on each request (no caching)

### Key Patterns

**Command structure**: Commands export default `CommandHandler` with:
- `data`: Raw Discord API command definition (JSON, not SlashCommandBuilder)
- `execute(interaction, env)`: Returns `APIInteractionResponse`

**Message builders**: Use raw Discord API objects instead of discord.js builders:
```typescript
// Embeds
{ title: "...", description: "...", color: 0xffffff }

// Buttons
{ type: ComponentType.Button, style: ButtonStyle.Primary, custom_id: "..." }
```

## Deploy Commands Script

The `deploy-commands` script uses discord.js REST client and requires environment variables:
```bash
export DISCORD_TOKEN=your_token
export DISCORD_CLIENT_ID=your_client_id
npm run deploy-commands
```
