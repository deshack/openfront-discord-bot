import {
  APIInteraction,
  InteractionResponseType,
  InteractionType,
} from "discord-api-types/v10";
import { handleInteraction } from "./handlers/interaction";
import { Env } from "./types/env";
import { verifyDiscordRequest } from "./util/verify";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { isValid, body } = await verifyDiscordRequest(
      request,
      env.DISCORD_PUBLIC_KEY,
    );

    if (!isValid) {
      return new Response("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(body) as APIInteraction;

    if (interaction.type === InteractionType.Ping) {
      return Response.json({ type: InteractionResponseType.Pong });
    }

    const response = await handleInteraction(interaction, env);

    return Response.json(response);
  },
};
