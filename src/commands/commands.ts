import {
  ChatInputCommandInteraction,
  CommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from "discord.js";

export interface CommandData<InteractionType, Builder = SlashCommandBuilder> {
  data: Builder;
  execute: (ctx: InteractionType) => Promise<void>;
}

export abstract class Command {
  public abstract toJSON(): RESTPostAPIApplicationCommandsJSONBody;
  public abstract execute(interaction: CommandInteraction): Promise<void>;
  public abstract getKey(): string;
}

export class ChatInputCommand extends Command {
  constructor(public cmd: CommandData<ChatInputCommandInteraction>) {
    super();
  }

  public override toJSON(): RESTPostAPIApplicationCommandsJSONBody {
    return this.cmd.data.toJSON();
  }

  public override execute(interaction: CommandInteraction): Promise<void> {
    return this.cmd.execute(interaction as ChatInputCommandInteraction);
  }

  public override getKey(): string {
    return this.cmd.data.name;
  }
}
