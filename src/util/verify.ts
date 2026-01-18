import { verifyKey } from "discord-interactions";

export async function verifyDiscordRequest(
  request: Request,
  publicKey: string,
): Promise<{ isValid: boolean; body: string }> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp) {
    return { isValid: false, body: "" };
  }

  const body = await request.text();
  const isValid = await verifyKey(body, signature, timestamp, publicKey);

  return { isValid, body };
}
