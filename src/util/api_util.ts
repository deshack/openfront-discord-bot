import {
  ClanLeaderboardData,
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
  PublicFFALeaderboardEntry,
} from "./api_schemas";
import { Env } from "../types/env";

const API_PUBLIC_FFA_LEADERBOARD_PATH =
  "https://api.openfront.io/leaderboard/public/ffa";
const API_CLAN_LEADERBOARD_PATH =
  "https://api.openfront.io/public/clans/leaderboard";
const API_CLAN_STATS_PATH = "https://api.openfront.io/public/clan/";
const API_CLAN_SESSIONS_PATH = "https://api.openfront.io/public/clan/";
const API_PLAYER_PATH = "https://api.openfront.io/player/";
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
  console.debug(`OpenFront API → ${url}`, headers);
  return fetch(url, { headers });
}

export async function getPublicFFALeaderboard(
  env: Env,
): Promise<ApiResponse<PublicFFALeaderboardEntry[]> | undefined> {
  const res = await apiFetch(API_PUBLIC_FFA_LEADERBOARD_PATH, env);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`Failed to fetch FFA leaderboard: HTTP ${res.status} - ${body}`);
    return undefined;
  }

  const json = (await res.json()) as PublicFFALeaderboardEntry[];
  json.forEach((value) => {
    if (value.user === null) {
      value.user = undefined;
    }
  });

  return {
    data: json,
    fetchedAt: Date.now(),
  };
}

export async function getClanLeaderboard(
  env: Env,
): Promise<ApiResponse<ClanLeaderboardData> | undefined> {
  const res = await apiFetch(API_CLAN_LEADERBOARD_PATH, env);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`Failed to fetch clan leaderboard: HTTP ${res.status} - ${body}`);
    return undefined;
  }

  const json = (await res.json()) as ClanLeaderboardData;

  return {
    data: json,
    fetchedAt: Date.now(),
  };
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
    allSessions.push(...json.results);

    if (allSessions.length >= json.total || json.results.length < SESSIONS_PAGE_LIMIT) {
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
): Promise<ApiResponse<PlayerSession[]> | undefined> {
  const url = `${API_PLAYER_SESSIONS_PATH}${encodeURIComponent(playerId)}/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await apiFetch(url, env);

  if (res.status !== 200) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`Failed to fetch player sessions for ${playerId}: HTTP ${res.status} - ${body}`);
    return undefined;
  }

  const json = (await res.json()) as PlayerSession[];

  return {
    data: json,
    fetchedAt: Date.now(),
  };
}
