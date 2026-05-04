export type GameID = string;
export const PROD_URL = "https://openfront.io";
export const CDN_BASE = "https://ofcdn.dev/game_assets";
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

let manifestPromise: Promise<Record<string, string>> | null = null;

function getAssetManifest(): Promise<Record<string, string>> {
  manifestPromise ??= fetch(`${PROD_URL}/asset-manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
    .catch(() => ({}));
  return manifestPromise;
}

export async function mapUrl(map: string): Promise<string> {
  const normalizedMap = map ? map.toLowerCase().replace(/[\s.()]+/g, "") : null;
  if (!normalizedMap) return `${CDN_BASE}/images/GameplayScreenshot.png`;

  const manifest = await getAssetManifest();
  const hashedPath = manifest[`maps/${normalizedMap}/thumbnail.webp`];
  if (hashedPath) {
    return `${CDN_BASE.replace(/\/+$/, "")}${hashedPath}`;
  }

  return `${CDN_BASE}/images/GameplayScreenshot.png`;
}
