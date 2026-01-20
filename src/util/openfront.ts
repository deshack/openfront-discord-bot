export type GameID = string;
export const PROD_URL = "https://openfront.io";
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

export function mapUrl(map: string): string {
  // Normalize map name to match filesystem (lowercase, no spaces or special chars)
  const normalizedMap = map ? map.toLowerCase().replace(/[\s.()]+/g, "") : null;

  const mapThumbnail = normalizedMap
    ? `${PROD_URL}/maps/${encodeURIComponent(normalizedMap)}/thumbnail.webp`
    : null;
  return mapThumbnail ?? `${PROD_URL}/images/GameplayScreenshot.png`;
}
