import {
  APIActionRowComponent,
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
}

export interface MessageDataWithFiles {
  message: MessageData;
  files?: FileAttachment[];
}
