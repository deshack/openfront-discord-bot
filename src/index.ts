import { Client, Events, GatewayIntentBits } from "discord.js";
import config from "../config.json" with { type: "json" };

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.login(config.token);
