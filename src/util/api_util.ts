import {
  ClanLeaderboardData,
  ClanSession,
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

export async function getPublicFFALeaderboard(): Promise<
  ApiResponse<PublicFFALeaderboardEntry[]> | undefined
> {
  const res = await fetch(API_PUBLIC_FFA_LEADERBOARD_PATH);
  if (res.status !== 200) {
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

export async function getClanLeaderboard(): Promise<
  ApiResponse<ClanLeaderboardData> | undefined
> {
  const res = await fetch(API_CLAN_LEADERBOARD_PATH);
  if (res.status !== 200) {
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
): Promise<{ stats: ClanStats; fetchedAt: number } | undefined> {
  const url = `${API_CLAN_STATS_PATH}${encodeURIComponent(clanTag)}`;
  const res = await fetch(url);
  if (res.status !== 200) {
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
): Promise<{ player: PlayerPublic; fetchedAt: number } | undefined> {
  const url = `${API_PLAYER_PATH}${encodeURIComponent(publicId)}`;
  const res = await fetch(url);
  if (res.status !== 200) {
    return undefined;
  }

  const json = (await res.json()) as PlayerPublicRaw;

  return {
    player: playerPublicRawToPlayerPublic(json),
    fetchedAt: Date.now(),
  };
}

export async function getClanSessions(
  clanTag: string,
  start: string,
  end: string,
): Promise<ApiResponse<ClanSession[]> | undefined> {
  const url = `${API_CLAN_SESSIONS_PATH}${encodeURIComponent(clanTag)}/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  if (res.status !== 200) {
    return undefined;
  }

  const json = (await res.json()) as ClanSession[];

  return {
    data: json,
    fetchedAt: Date.now(),
  };
}

export interface GetGameInfoOptions {
  includeTurns?: boolean;
}

export async function getGameInfo(
  gameId: string,
  options?: GetGameInfoOptions,
): Promise<ApiResponse<GameInfoResponse> | undefined> {
  let url = `${API_GAME_INFO_PATH}${encodeURIComponent(gameId)}`;

  if (options?.includeTurns === false) {
    url += "?turns=false";
  }

  const res = await fetch(url);
  if (res.status !== 200) {
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
): Promise<ApiResponse<PlayerSession[]> | undefined> {
  const url = `${API_PLAYER_SESSIONS_PATH}${encodeURIComponent(playerId)}/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  if (res.status !== 200) {
    return undefined;
  }

  const json = (await res.json()) as PlayerSession[];

  return {
    data: json,
    fetchedAt: Date.now(),
  };
}
