import { FileAttachment, buildMultipartBody } from "./multipart";

const DISCORD_API = "https://discord.com/api/v10";

export async function patchOriginalResponse(
  clientId: string,
  token: string,
  payload: object,
  files?: FileAttachment[],
): Promise<void> {
  const url = `${DISCORD_API}/webhooks/${clientId}/${token}/messages/@original`;

  let body: BodyInit;
  let contentType: string;

  if (files && files.length > 0) {
    const { body: multipartBody, boundary } = buildMultipartBody(payload, files);
    body = multipartBody.buffer as ArrayBuffer;
    contentType = `multipart/form-data; boundary=${boundary}`;
  } else {
    body = JSON.stringify(payload);
    contentType = "application/json";
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook PATCH failed (${res.status}): ${text}`);
  }
}
