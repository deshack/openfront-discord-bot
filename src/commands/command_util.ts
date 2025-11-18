import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Command } from "./commands";

/**
 * Loads all commands and returns them
 */
export async function discover_commands(): Promise<Command[]> {
  const commands: Command[] = [];
  const commandsRootDir = import.meta.dirname;
  const commandDirs = readdirSync(commandsRootDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  for (const commandDir of commandDirs) {
    const commandFiles = readdirSync(join(commandsRootDir, commandDir), {
      withFileTypes: true,
    })
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith(".js"))
      .map((dirent) => dirent.name);
    for (const commandFile of commandFiles) {
      const filePath = join(commandsRootDir, commandDir, commandFile);
      const importedFile = await import(filePath);
      if (importedFile === undefined) {
        console.warn(`Failed to import ${filePath}`);
        continue;
      }
      const command: Command = importedFile.command;
      if (command === undefined) {
        console.warn(`${filePath} does not export 'command'`);
        continue;
      }
      commands.push(command);
    }
  }
  return commands;
}
