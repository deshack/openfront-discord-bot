import {
  ClanSession,
  ClanSessionsApiResponse,
  ClanStats,
  GameInfoResponse,
  GameInfoResponseRaw,
  gameInfoResponseRawToGameInfoResponse,
  PlayerPublic,
  PlayerPublicRaw,
  playerPublicRawToPlayerPublic,
  PlayerSession,
  PlayerSessionsApiResponse,
} from "./api_schemas";
import { Env } from "../types/env";

const API_CLAN_STATS_PATH = "https://api.openfront.io/public/clan/";
const API_CLAN_SESSIONS_PATH = "https://api.openfront.io/public/clan/";
const API_PLAYER_PATH = "https://api.openfront.io/public/player/";
const API_PLAYER_SESSIONS_PATH = "https://api.openfront.io/public/player/";
const API_GAME_INFO_PATH = "https://api.openfront.io/public/game/";

export interface ApiResponse<T> {
  data: T;
  fetchedAt: number;
}

function buildOpenFrontHeaders(env: Env): Record<string, string> {
  const headers: Record<string, string> = {};

  if (env.OPENFRONT_USER_AGENT) {
    headers["User-Agent"] = env.OPENFRONT_USER_AGENT;
  }

  if (env.OPENFRONT_CUSTOM_HEADER_NAME && env.OPENFRONT_CUSTOM_HEADER_VALUE) {
    headers[env.OPENFRONT_CUSTOM_HEADER_NAME] = env.OPENFRONT_CUSTOM_HEADER_VALUE;
  }

  return headers;
}

async function apiFetch(url: string, env: Env): Promise<Response> {
  const headers = buildOpenFrontHeaders(env);
  // console.debug(`OpenFront API → ${url}`, {headers});
  return fetch(url, { headers });
}

export async function getClanStats(
  clanTag: string,
  env: Env,
): Promise<{ stats: ClanStats; fetchedAt: number } | undefined> {
  const url = `${API_CLAN_STATS_PATH}${encodeURIComponent(clanTag)}`;
  const res = await apiFetch(url, env);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`Failed to fetch clan stats for ${clanTag}: HTTP ${res.status} - ${body}`);
    return undefined;
  }

  const json = ((await res.json()) as { clan: ClanStats }).clan;

  return {
    stats: json,
    fetchedAt: Date.now(),
  };
}

export async function getPlayerPublic(
  publicId: string,
  env: Env,
): Promise<{ player: PlayerPublic; fetchedAt: number } | undefined> {
  const url = `${API_PLAYER_PATH}${encodeURIComponent(publicId)}`;
  const res = await apiFetch(url, env);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`Failed to fetch player public for ${publicId}: HTTP ${res.status} - ${body}`);
    return undefined;
  }

  const json = (await res.json()) as PlayerPublicRaw;

  return {
    player: playerPublicRawToPlayerPublic(json),
    fetchedAt: Date.now(),
  };
}

const SESSIONS_PAGE_LIMIT = 50;

export async function getClanSessions(
  clanTag: string,
  start: string,
  end: string,
  env: Env,
): Promise<ApiResponse<ClanSession[]> | undefined> {
  const allSessions: ClanSession[] = [];
  let page = 1;

  while (true) {
    const url = `${API_CLAN_SESSIONS_PATH}${encodeURIComponent(clanTag)}/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&page=${page}&limit=${SESSIONS_PAGE_LIMIT}`;
    const res = await apiFetch(url, env);

    if (res.status !== 200) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`Failed to fetch clan sessions for ${clanTag}: HTTP ${res.status} - ${body}`);
      return undefined;
    }

    const json = (await res.json()) as ClanSessionsApiResponse;
    const results = Array.isArray(json.results) ? json.results : [];
    allSessions.push(...results);

    if (allSessions.length >= json.total || results.length < SESSIONS_PAGE_LIMIT) {
      break;
    }

    page++;
  }

  return {
    data: allSessions,
    fetchedAt: Date.now(),
  };
}

export interface GetGameInfoOptions {
  includeTurns?: boolean;
}

export async function getGameInfo(
  gameId: string,
  options: GetGameInfoOptions | undefined,
  env: Env,
): Promise<ApiResponse<GameInfoResponse> | undefined> {
  let url = `${API_GAME_INFO_PATH}${encodeURIComponent(gameId)}`;

  if (options?.includeTurns === false) {
    url += "?turns=false";
  }

  const res = await apiFetch(url, env);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`Failed to fetch game info for ${gameId}: HTTP ${res.status} - ${body}`);
    return undefined;
  }

  const json = (await res.json()) as GameInfoResponseRaw;

  return {
    data: gameInfoResponseRawToGameInfoResponse(json),
    fetchedAt: Date.now(),
  };
}

export async function getPlayerSessions(
  playerId: string,
  start: string,
  end: string,
  env: Env,
): Promise<ApiResponse<PlayerSession[]> | "not_found" | undefined> {
  const allSessions: PlayerSession[] = [];
  let cursor: string | undefined;

  while (true) {
    const url =
      `${API_PLAYER_SESSIONS_PATH}${encodeURIComponent(playerId)}/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const res = await apiFetch(url, env);

    if (res.status === 404) {
      console.warn(`Player sessions not found for ${playerId} (HTTP 404) — Player ID is likely invalid or the account was deleted.`);
      return "not_found";
    }

    if (res.status !== 200) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`Failed to fetch player sessions for ${playerId}: HTTP ${res.status} - ${body}`);
      return undefined;
    }

    const json = (await res.json()) as PlayerSessionsApiResponse;
    const results = Array.isArray(json?.results) ? json.results : [];
    allSessions.push(...results);

    if (!json?.nextCursor) {
      break;
    }
    cursor = json.nextCursor;
  }

  return {
    data: allSessions,
    fetchedAt: Date.now(),
  };
}
