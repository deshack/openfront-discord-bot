import { execFileSync } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const API_PLAYER_PATH = "https://api.openfront.io/public/player/";
const REQUEST_DELAY_MS = 250;

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

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (process.env.OPENFRONT_USER_AGENT) {
    headers["User-Agent"] = process.env.OPENFRONT_USER_AGENT;
  }

  if (
    process.env.OPENFRONT_CUSTOM_HEADER_NAME &&
    process.env.OPENFRONT_CUSTOM_HEADER_VALUE
  ) {
    headers[process.env.OPENFRONT_CUSTOM_HEADER_NAME] =
      process.env.OPENFRONT_CUSTOM_HEADER_VALUE;
  }

  return headers;
}

interface D1QueryResult<T> {
  results: T[];
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

async function fetchProfileUsername(
  playerId: string,
  headers: Record<string, string>,
): Promise<string | undefined> {
  const res = await fetch(`${API_PLAYER_PATH}${encodeURIComponent(playerId)}`, {
    headers,
  });

  if (!res.ok) {
    console.warn(`  ${playerId}: HTTP ${res.status}, skipping`);
    return undefined;
  }

  const json = (await res.json()) as { username?: string | null };
  const username = json.username?.trim();
  return username && username.length > 0 ? username : undefined;
}

async function main() {
  loadDevVars();

  console.log("Fetching registered players without a cached profile username...");
  const rows = queryD1<{ player_id: string }>(
    "SELECT DISTINCT player_id FROM player_registrations WHERE profile_username IS NULL",
  );
  const playerIds = rows.map((r) => r.player_id);
  console.log(`Found ${playerIds.length} player(s) to check.`);

  if (playerIds.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const headers = buildHeaders();
  const updates: { playerId: string; username: string }[] = [];

  for (let i = 0; i < playerIds.length; i++) {
    const playerId = playerIds[i];
    const progress = `[${i + 1}/${playerIds.length}]`;

    try {
      const username = await fetchProfileUsername(playerId, headers);
      if (username) {
        updates.push({ playerId, username });
        console.log(`${progress} ${playerId} -> ${username}`);
      } else {
        console.log(`${progress} ${playerId}: no profile username set`);
      }
    } catch (error) {
      console.warn(`${progress} ${playerId}: request failed`, error);
    }

    if (i < playerIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }

  if (updates.length === 0) {
    console.log("No profile usernames found to backfill.");
    return;
  }

  const sql = updates
    .map(
      ({ playerId, username }) =>
        `UPDATE player_registrations SET profile_username = '${sqlEscape(username)}' WHERE player_id = '${sqlEscape(playerId)}';`,
    )
    .join("\n");

  const filePath = join(tmpdir(), `backfill-profile-usernames-${Date.now()}.sql`);
  writeFileSync(filePath, sql, "utf-8");

  console.log(`Applying ${updates.length} update(s) to the remote database...`);
  applyD1File(filePath);
  unlinkSync(filePath);

  console.log("Done.");
}

await main();
