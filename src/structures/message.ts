import { APIActionRowComponent, APIButtonComponent, APIEmbed } from "discord-api-types/v10";

export interface MessageData {
  content?: string;
  embeds?: APIEmbed[];
  components?: APIActionRowComponent<APIButtonComponent>[];
  flags?: number;
}
