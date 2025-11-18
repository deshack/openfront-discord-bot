import {
  Client,
  Events,
  GatewayIntentBits,
  InteractionReplyOptions,
  MessageFlags,
} from "discord.js";
import config from "../config.json" with { type: "json" };
import { discover_commands } from "./commands/command_util";
import { Command } from "./commands/commands";

const command_error_message: InteractionReplyOptions = {
  content: "There was an error while executing this command :(",
  flags: MessageFlags.Ephemeral,
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = await discover_commands();
const commandsMap: Map<string, Command> = new Map();

function load_commands() {
  for (const command of commands) {
    commandsMap.set(command.getKey(), command);
  }
}

client.on(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;
  try {
    const command = commandsMap.get(interaction.commandName);
    if (command === undefined) {
      console.warn(`Unknown command: "${interaction.commandName}".`);
      return;
    }
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(command_error_message);
    } else {
      await interaction.reply(command_error_message);
    }
  }
});

load_commands();
client.login(config.token);
