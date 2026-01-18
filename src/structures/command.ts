import {
  APIApplicationCommandInteraction,
  APIInteractionResponse,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord-api-types/v10";
import { Env } from "../types/env";

export interface CommandHandler {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(
    interaction: APIApplicationCommandInteraction,
    env: Env,
  ): Promise<APIInteractionResponse>;
}
