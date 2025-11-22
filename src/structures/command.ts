import { CommandInteraction, SharedSlashCommand } from "discord.js";

export interface CommandHandler {
  data: SharedSlashCommand;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  options?: {};
  execute(interaction: CommandInteraction): Promise<void>;
}
