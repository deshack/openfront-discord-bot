import { readFileSync, existsSync } from "fs";
import { REST, Routes } from "discord.js";
import { commands } from "../commands";

function loadDevVars(): void {
  const devVarsPath = ".dev.vars";
  if (!existsSync(devVarsPath)) {
    return;
  }

  const content = readFileSync(devVarsPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    process.env[key] ??= value;
  }
}

async function deployCommands() {
  loadDevVars();

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token) {
    console.error(
      "DISCORD_TOKEN environment variable is required. Set it via:",
    );
    console.error("  export DISCORD_TOKEN=your_token_here");
    process.exit(1);
  }

  if (!clientId) {
    console.error(
      "DISCORD_CLIENT_ID environment variable is required. Set it via:",
    );
    console.error("  export DISCORD_CLIENT_ID=your_client_id_here");
    process.exit(1);
  }

  const commandData = Object.values(commands).map((command) => command.data);

  const rest = new REST().setToken(token);

  try {
    console.log(
      `Started refreshing ${commandData.length} application (/) commands.`,
    );
    const data = (await rest.put(Routes.applicationCommands(clientId), {
      body: commandData,
    })) as unknown[];
    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
  } catch (error) {
    console.error(error);
  }
}

await deployCommands();
