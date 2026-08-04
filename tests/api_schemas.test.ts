import {
  GameDifficulty,
  GameInfoResponseRaw,
  GameMode,
  GameType,
  gameInfoResponseRawToGameInfoResponse,
} from "../src/util/api_schemas";

function buildRaw(
  winner: GameInfoResponseRaw["info"]["winner"],
  overrides: Partial<GameInfoResponseRaw["info"]["config"]> = {},
): GameInfoResponseRaw {
  return {
    version: "1",
    gitCommit: "abc123",
    domain: "openfront.io",
    subdomain: "api",
    info: {
      gameID: "gameId",
      config: {
        gameMap: "Australia",
        difficulty: GameDifficulty.Medium,
        donateGold: false,
        donateTroops: false,
        gameType: GameType.Public,
        gameMode: GameMode.Team,
        gameMapSize: "Compact",
        bots: 100,
        infiniteGold: false,
        infiniteTroops: false,
        instantBuild: false,
        disabledUnits: [],
        playerTeams: 2,
        disableNPCs: false,
        rankedType: "2v2",
        maxPlayers: 4,
        ...overrides,
      },
      players: [],
      start: 0,
      end: 1000,
      duration: 1000,
      num_turns: 100,
      winner,
    },
  };
}

describe("gameInfoResponseRawToGameInfoResponse", () => {
  it("maps a player-shaped winner", () => {
    const raw = buildRaw(["player", "clientA"], {
      gameMode: GameMode.FFA,
      rankedType: undefined,
      maxPlayers: 2,
    });

    const result = gameInfoResponseRawToGameInfoResponse(raw);

    expect(result.info.winner).toEqual({
      type: "player",
      clientID: "clientA",
    });
  });

  it("maps a team-shaped winner to its team name and client ids", () => {
    const raw = buildRaw(["team", "Blue", "fiPkuwSx", "Tjy9fGyq"]);

    const result = gameInfoResponseRawToGameInfoResponse(raw);

    expect(result.info.winner).toEqual({
      type: "team",
      teamName: "Blue",
      clientIds: ["fiPkuwSx", "Tjy9fGyq"],
    });
  });

  it("maps a null winner to undefined", () => {
    const raw = buildRaw(null);

    const result = gameInfoResponseRawToGameInfoResponse(raw);

    expect(result.info.winner).toBeUndefined();
  });
});
