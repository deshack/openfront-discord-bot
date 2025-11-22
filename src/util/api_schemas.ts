export interface PublicFFALeaderboardEntry {
  wlr: number;
  wins: number;
  losses: number;
  total: number;
  public_id: string;
  user?: {
    id: string;
    username: string;
    discriminator: string;
    global_name: string;
    avatar: string;
  };
}

export interface ClanLeaderboardData {
  start: string;
  end: string;
  clans: {
    clanTag: string;
    games: number;
    wins: number;
    losses: number;
    playerSessions: number;
    weightedWins: number;
    weightedLosses: number;
    weightedWLRatio: number;
  }[];
}

export interface ClanStats {
  clanTag: string;
  games: number;
  playerSessions: number;
  wins: number;
  losses: number;
  weightedWins: number;
  weightedLosses: number;
  weightedWLRatio: number;
  teamTypeWL: Record<
    string,
    { wl: [number, number]; weightedWL: [number, number] }
  >;
  teamCountWL: Record<
    number,
    { wl: [number, number]; weightedWL: [number, number] }
  >;
}

export enum GameDifficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard",
  Impossible = "Impossible",
}

export enum GameType {
  Private = "Private",
  Public = "Public",
  Singleplayer = "Singleplayer",
}

export enum GameMode {
  FFA = "Free For All",
  Team = "Team",
}

export type MapName = string;

export interface GameSchemaRaw {
  gameId: string;
  start: string;
  mode: GameMode;
  type: GameType;
  map: MapName;
  difficulty: GameDifficulty;
  clientId: string;
}

export interface GameSchema {
  gameId: string;
  start: Date;
  mode: GameMode;
  type: GameType;
  map: MapName;
  difficulty: GameDifficulty;
  clientId: string;
}

export interface DiscordUserSchema {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
}

type PlayerStats =
  | {
      attacks?: bigint[] | undefined;
      betrayals?: bigint | undefined;
      killedAt?: bigint | undefined;
      conquests?: bigint | undefined;
      boats?: Partial<Record<"trade" | "trans", bigint[]>> | undefined;
      bombs?:
        | Partial<Record<"abomb" | "hbomb" | "mirv" | "mirvw", bigint[]>>
        | undefined;
      gold?: bigint[] | undefined;
      units?:
        | Partial<
            Record<
              "city" | "defp" | "port" | "saml" | "silo" | "wshp" | "fact",
              bigint[]
            >
          >
        | undefined;
    }
  | undefined;

type LayeredStatsRaw = Partial<
  Record<
    GameType,
    Partial<
      Record<
        GameMode,
        Partial<
          Record<
            GameDifficulty,
            {
              wins: string | null;
              losses: string | null;
              total: string | null;
              stats: PlayerStats;
            }
          >
        >
      >
    >
  >
>;

type LayeredStats = Partial<
  Record<
    GameType,
    Partial<
      Record<
        GameMode,
        Partial<
          Record<
            GameDifficulty,
            {
              wins?: number;
              losses?: number;
              total?: number;
              stats: PlayerStats;
            }
          >
        >
      >
    >
  >
>;

export interface PlayerPublicRaw {
  createdAt: string | null;
  user?: DiscordUserSchema;
  games: GameSchemaRaw[];
  stats: LayeredStatsRaw;
}

export interface PlayerPublic {
  createdAt?: Date;
  user?: DiscordUserSchema;
  games: GameSchema[];
  stats: LayeredStats;
}

export function playerPublicRawToPlayerPublic(
  raw: PlayerPublicRaw,
): PlayerPublic {
  const notRaw: PlayerPublic = {
    createdAt: raw.createdAt === null ? undefined : new Date(raw.createdAt),
    user: raw.user,
    games: raw.games.map((game) => gameSchemaRawToGameSchema(game)),
    stats: layeredStatsRawToLayeredStats(raw.stats),
  };
  return notRaw;
}

function gameSchemaRawToGameSchema(raw: GameSchemaRaw): GameSchema {
  return {
    gameId: raw.gameId,
    start: new Date(raw.start),
    mode: raw.mode,
    type: raw.type,
    map: raw.map,
    difficulty: raw.difficulty,
    clientId: raw.clientId,
  };
}

function layeredStatsRawToLayeredStats(raw: LayeredStatsRaw): LayeredStats {
  const notRaw: LayeredStats = {};
  for (const typeKey in raw) {
    const gameTypeData: LayeredStatsRaw[GameType] = raw[typeKey];
    if (gameTypeData === undefined) {
      notRaw[typeKey] = undefined;
      continue;
    }
    notRaw[typeKey] = {};
    for (const modeKey in gameTypeData) {
      const gameModeData: (typeof gameTypeData)[GameMode] =
        gameTypeData[modeKey];
      if (gameModeData === undefined) {
        notRaw[typeKey][modeKey] = undefined;
        continue;
      }
      notRaw[typeKey][modeKey] = {};
      for (const difficultyKey in gameModeData) {
        const difficultyData: (typeof gameModeData)[GameDifficulty] =
          gameModeData[difficultyKey];
        if (difficultyData === undefined) {
          notRaw[typeKey][modeKey][difficultyKey] = undefined;
          continue;
        }
        notRaw[typeKey][modeKey][difficultyKey] = {
          wins: difficultyData.wins ?? undefined,
          losses: difficultyData.losses ?? undefined,
          total: difficultyData.total ?? undefined,
          stats: difficultyData.stats,
        };
      }
    }
  }
  return notRaw;
}
