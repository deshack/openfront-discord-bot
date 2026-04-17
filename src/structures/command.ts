import {
  APIApplicationCommandInteraction,
  APIInteractionResponse,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { InteractionResponseWithFiles } from "../handlers/interaction";
import { Env } from "../types/env";

export interface CommandContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

export interface CommandHandler {
  data: RESTPostAPIApplicationCommandsJSONBody;
  requiresPremium?: boolean;
  execute(
    interaction: APIApplicationCommandInteraction,
    env: Env,
    ctx?: CommandContext,
  ): Promise<APIInteractionResponse | InteractionResponseWithFiles>;
}
