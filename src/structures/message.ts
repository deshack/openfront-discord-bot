import {
  APIActionRowComponent,
  APIAllowedMentions,
  APIButtonComponent,
  APIEmbed,
} from "discord-api-types/v10";
import { FileAttachment } from "../util/multipart";

export interface AttachmentReference {
  id: string;
  filename: string;
}

export interface MessageData {
  content?: string;
  embeds?: APIEmbed[];
  components?: APIActionRowComponent<APIButtonComponent>[];
  flags?: number;
  attachments?: AttachmentReference[];
  allowed_mentions?: APIAllowedMentions;
}

export interface MessageDataWithFiles {
  message: MessageData;
  files?: FileAttachment[];
}
