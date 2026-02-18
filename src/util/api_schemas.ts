/**
 * Replace the types of fields in T that are specified in R with the type of them in R
 */
type Replace<T, R> = Omit<T, keyof R> & R;

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

export interface ClanSession {
  gameId: string;
  clanTag: string;
  clanPlayerCount: number;
  hasWon: boolean;
  numTeams: number;
  playerTeams: string;
  totalPlayerCount: number;
  gameStart: string;
  score: number;
}

export interface PlayerSession {
  gameId: string;
  gameStart: string;
  gameEnd: string;
  gameType: GameType;
  gameMode: GameMode;
  clientId: string;
  username: string;
  clanTag: string | null;
  hasWon: boolean;
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
type GameSchema = Replace<GameSchemaRaw, { start: Date }>;

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
export type PlayerPublic = Replace<
  PlayerPublicRaw,
  { createdAt?: Date; games: GameSchema[]; stats: LayeredStats }
>;

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

// ========== Game Info API Types ==========

export interface GamePlayerCosmetics {
  flag: string;
}

export interface GamePlayerStatsRaw {
  attacks?: number[];
  betrayals?: string;
  conquests?: string;
  killedAt?: string;
  boats?: Partial<Record<"trade" | "trans", number[]>>;
  bombs?: Partial<Record<"abomb" | "hbomb" | "mirv" | "mirvw", number[]>>;
  gold?: number[];
  units?: Partial<
    Record<"city" | "defp" | "port" | "saml" | "silo" | "wshp" | "fact", number[]>
  >;
}

export interface GamePlayerRaw {
  clientID: string;
  username: string;
  persistentID: string | null;
  clanTag: string | null;
  cosmetics: GamePlayerCosmetics;
  stats: GamePlayerStatsRaw;
}

export interface GameConfigRaw {
  gameMap: string;
  difficulty: GameDifficulty;
  donateGold: boolean;
  donateTroops: boolean;
  gameType: GameType;
  gameMode: GameMode;
  gameMapSize: string;
  bots: number;
  infiniteGold: boolean;
  infiniteTroops: boolean;
  instantBuild: boolean;
  disabledUnits: string[];
  playerTeams: number;
  disableNPCs: boolean;
  rankedType?: string;
  maxPlayers?: number;
}

export interface GameInfoRaw {
  gameID: string;
  config: GameConfigRaw;
  players: GamePlayerRaw[];
  start: number;
  end: number;
  duration: number;
  num_turns: number;
  winner: ["player", string] | null;
}

export interface GameIntent {
  clientID: string;
  type: string;
  [key: string]: unknown;
}

export interface GameTurn {
  turnNumber: number;
  intents: GameIntent[];
  hash?: number;
}

export interface GameInfoResponseRaw {
  version: string;
  gitCommit: string;
  domain: string;
  subdomain: string;
  info: GameInfoRaw;
  turns?: GameTurn[];
}

export interface GamePlayer {
  clientID: string;
  username: string;
  persistentID?: string;
  clanTag?: string;
  cosmetics: GamePlayerCosmetics;
  stats: GamePlayerStatsRaw;
}

export interface GameInfo {
  gameID: string;
  config: GameConfigRaw;
  players: GamePlayer[];
  start: Date;
  end: Date;
  duration: number;
  numTurns: number;
  winner?: { type: "player"; clientID: string };
}

export interface GameInfoResponse {
  version: string;
  gitCommit: string;
  domain: string;
  subdomain: string;
  info: GameInfo;
  turns?: GameTurn[];
}

export function gameInfoResponseRawToGameInfoResponse(
  raw: GameInfoResponseRaw,
): GameInfoResponse {
  return {
    version: raw.version,
    gitCommit: raw.gitCommit,
    domain: raw.domain,
    subdomain: raw.subdomain,
    info: {
      gameID: raw.info.gameID,
      config: raw.info.config,
      players: raw.info.players.map((player) => ({
        clientID: player.clientID,
        username: player.username,
        persistentID: player.persistentID ?? undefined,
        clanTag: player.clanTag ?? undefined,
        cosmetics: player.cosmetics,
        stats: player.stats,
      })),
      start: new Date(raw.info.start),
      end: new Date(raw.info.end),
      duration: raw.info.duration,
      numTurns: raw.info.num_turns,
      winner:
        raw.info.winner === null
          ? undefined
          : { type: raw.info.winner[0], clientID: raw.info.winner[1] },
    },
    turns: raw.turns,
  };
}
