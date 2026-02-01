import {
  APIApplicationCommandInteraction,
  APIInteractionResponse,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { Env } from "../types/env";

export interface CommandContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

export interface CommandHandler {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  requiresPremium?: boolean;
  execute(
    interaction: APIApplicationCommandInteraction,
    env: Env,
    ctx?: CommandContext,
  ): Promise<APIInteractionResponse>;
}
