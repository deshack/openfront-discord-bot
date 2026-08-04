const POSTED_PREFIX = "posted:";
const FFA_POSTED_PREFIX = "ffa_posted:";
const TEAM_RANKED_POSTED_PREFIX = "team_ranked_posted:";
const POSTED_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function isGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<boolean> {
  const key = `${POSTED_PREFIX}${guildId}:${gameId}`;
  const value = await kv.get(key);
  return value !== null;
}

export async function markGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<void> {
  const key = `${POSTED_PREFIX}${guildId}:${gameId}`;
  await kv.put(key, String(Date.now()), { expirationTtl: POSTED_TTL_SECONDS });
}

export async function isFFAGamePosted(
  kv: KVNamespace,
  guildId: string,
  playerId: string,
  gameId: string,
): Promise<boolean> {
  const key = `${FFA_POSTED_PREFIX}${guildId}:${playerId}:${gameId}`;
  const value = await kv.get(key);
  return value !== null;
}

export async function markFFAGamePosted(
  kv: KVNamespace,
  guildId: string,
  playerId: string,
  gameId: string,
): Promise<void> {
  const key = `${FFA_POSTED_PREFIX}${guildId}:${playerId}:${gameId}`;
  await kv.put(key, String(Date.now()), { expirationTtl: POSTED_TTL_SECONDS });
}

export async function isTeamGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<boolean> {
  const key = `${TEAM_RANKED_POSTED_PREFIX}${guildId}:${gameId}`;
  const value = await kv.get(key);
  return value !== null;
}

export async function markTeamGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<void> {
  const key = `${TEAM_RANKED_POSTED_PREFIX}${guildId}:${gameId}`;
  await kv.put(key, String(Date.now()), { expirationTtl: POSTED_TTL_SECONDS });
}

export async function unmarkGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<void> {
  await kv.delete(`${POSTED_PREFIX}${guildId}:${gameId}`);
}

export async function unmarkAllFFAGamePosted(
  kv: KVNamespace,
  guildId: string,
  gameId: string,
): Promise<void> {
  const prefix = `${FFA_POSTED_PREFIX}${guildId}:`;
  let cursor: string | undefined;

  do {
    const result: KVNamespaceListResult<unknown, string> = await kv.list({
      prefix,
      cursor,
    });

    await Promise.all(
      result.keys
        .filter((k) => k.name.endsWith(`:${gameId}`))
        .map((k) => kv.delete(k.name)),
    );

    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
}
