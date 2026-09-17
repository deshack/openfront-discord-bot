export type GameID = string;
export const PROD_URL = "https://openfront.io";
const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/openfrontio/OpenFrontIO";
const OPENFRONT_TOOLS_URL = "https://openfront-tools.frozenpenguin.media";
const OFSTATS_REPLAY_URL = "https://replay.ofstats.io/game";
const numWorkers = 20;

export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function getWorkerIndex(gameID: GameID): number {
  return simpleHash(gameID) % numWorkers;
}

export function workerPath(gameID: GameID): string {
  return `w${getWorkerIndex(gameID)}`;
}

export function gameUrl(gameID: GameID): string {
  return `${PROD_URL}/${workerPath(gameID)}/game/${gameID}`;
}

export function replayUrl(gameID: GameID): string {
  return `${OPENFRONT_TOOLS_URL}/?gameid=${gameID}`;
}

export function ofStatsReplayUrl(gameID: GameID): string {
  return `${OFSTATS_REPLAY_URL}/${gameID}`;
}

export function mapUrl(map: string, commitSha?: string): string {
  const ref = commitSha ?? "main";
  const normalizedMap = map ? map.toLowerCase().replace(/[\s.()]+/g, "") : null;

  if (!normalizedMap) {
    return `${GITHUB_RAW_BASE}/${ref}/resources/images/GameplayScreenshot.png`;
  }

  const url = `${GITHUB_RAW_BASE}/${ref}/resources/maps/${normalizedMap}/thumbnail.webp`;
  console.debug(`Map thumbnail URL for ${map} (${ref}): ${url}`);
  return url;
}
