import { MessageData } from "../structures/message";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

export type SendMessageResult = { success: true } | { success: false; discordCode?: number };

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendChannelMessage(
  token: string,
  channelId: string,
  message: MessageData,
): Promise<SendMessageResult> {
  const url = `${DISCORD_API_BASE}/channels/${channelId}/messages`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader
        ? parseFloat(retryAfterHeader) * 1000
        : BASE_BACKOFF_MS * Math.pow(2, attempt);

      console.warn(
        `Rate limited on channel ${channelId}, retrying after ${retryAfterMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(retryAfterMs);
      continue;
    }

    let discordCode: number | undefined;
    try {
      const body = await response.json() as { code?: number };
      discordCode = body.code;
    } catch {
      // ignore parse errors
    }

    console.error(
      `Failed to send message to channel ${channelId}: ${response.status} ${response.statusText} (Discord code: ${discordCode}) - body: ${JSON.stringify(message)}`,
    );

    return { success: false, discordCode };
  }

  console.error(
    `Exhausted retries for channel ${channelId} after ${MAX_RETRIES} attempts`,
  );

  return { success: false };
}
