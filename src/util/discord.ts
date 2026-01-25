import { MessageData } from "../structures/message";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function sendChannelMessage(
  token: string,
  channelId: string,
  message: MessageData,
): Promise<boolean> {
  const url = `${DISCORD_API_BASE}/channels/${channelId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error(
      `Failed to send message to channel ${channelId}: ${response.status} ${response.statusText} - body: ${JSON.stringify(message)}`,
    );
  }

  return response.ok;
}
