import { execFileSync } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function loadDevVars(): void {
  const devVarsPath = ".dev.vars";
  if (!existsSync(devVarsPath)) {
    return;
  }

  const content = readFileSync(devVarsPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    process.env[key] ??= value;
  }
}

interface D1QueryResult<T> {
  results: T[];
  meta?: { changes?: number };
}

function queryD1<T>(sql: string): T[] {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", "--remote", "--json", "--command", sql],
    { encoding: "utf-8" },
  );

  const parsed = JSON.parse(output) as D1QueryResult<T>[];
  return parsed[0]?.results ?? [];
}

function applyD1File(path: string): void {
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", "--remote", "--file", path],
    { stdio: "inherit" },
  );
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

interface RegistrationRow {
  guild_id: string;
  discord_user_id: string;
  player_id: string;
  profile_username: string | null;
  last_seen_username: string | null;
}

interface UsernameMappingRow {
  guild_id: string;
  discord_user_id: string;
  username: string;
}

/**
 * Merges legacy pre-public_id player_stats rows into each registered
 * player's public_id identity. This mirrors backfillPlayerStatsPublicId()
 * in src/util/stats.ts (run automatically on /player register), but as a
 * one-off pass over every existing registration. Doing this as a single
 * correlated-subquery migration blew D1's per-query CPU limit once
 * player_stats grew large, so instead it runs as a plain Node script that
 * issues one small, guild-scoped UPDATE per registration.
 */
async function main() {
  loadDevVars();

  console.log("Fetching player registrations and legacy username mappings...");
  const registrations = queryD1<RegistrationRow>(
    "SELECT guild_id, discord_user_id, player_id, profile_username, last_seen_username FROM player_registrations",
  );
  const usernameMappings = queryD1<UsernameMappingRow>(
    "SELECT guild_id, discord_user_id, username FROM username_mappings",
  );

  const mappedUsernames = new Map<string, string[]>();
  for (const mapping of usernameMappings) {
    const key = `${mapping.guild_id}:${mapping.discord_user_id}`;
    const usernames = mappedUsernames.get(key) ?? [];
    usernames.push(mapping.username);
    mappedUsernames.set(key, usernames);
  }

  const statements: string[] = [];

  for (const registration of registrations) {
    const key = `${registration.guild_id}:${registration.discord_user_id}`;
    const usernames = new Set<string>();

    if (registration.profile_username) {
      usernames.add(registration.profile_username.toLowerCase());
    }
    if (registration.last_seen_username) {
      usernames.add(registration.last_seen_username.toLowerCase());
    }
    for (const username of mappedUsernames.get(key) ?? []) {
      usernames.add(username.toLowerCase());
    }

    if (usernames.size === 0) {
      continue;
    }

    const usernameList = [...usernames]
      .map((u) => `'${sqlEscape(u)}'`)
      .join(", ");

    statements.push(
      `UPDATE player_stats SET public_id = '${sqlEscape(registration.player_id)}' ` +
        `WHERE guild_id = '${sqlEscape(registration.guild_id)}' ` +
        `AND public_id IS NULL ` +
        `AND LOWER(username) IN (${usernameList});`,
    );
  }

  console.log(
    `Built ${statements.length} update(s) from ${registrations.length} registration(s).`,
  );

  if (statements.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const beforeCount = queryD1<{ null_public_id: number }>(
    "SELECT COUNT(*) as null_public_id FROM player_stats WHERE public_id IS NULL",
  )[0]?.null_public_id ?? 0;

  const filePath = join(tmpdir(), `backfill-player-stats-public-id-${Date.now()}.sql`);
  writeFileSync(filePath, statements.join("\n"), "utf-8");

  console.log("Applying updates to the remote database...");
  applyD1File(filePath);
  unlinkSync(filePath);

  const afterCount = queryD1<{ null_public_id: number }>(
    "SELECT COUNT(*) as null_public_id FROM player_stats WHERE public_id IS NULL",
  )[0]?.null_public_id ?? 0;

  console.log(
    `Done. ${beforeCount - afterCount} player_stats row(s) merged into a public_id identity (${afterCount} still unmatched).`,
  );
}

await main();
