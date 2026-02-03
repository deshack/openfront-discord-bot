export interface FileAttachment {
  name: string;
  data: ArrayBuffer;
  contentType: string;
}

export function buildMultipartResponse(
  payload: object,
  files: FileAttachment[],
): Response {
  const boundary = `----FormBoundary${Date.now()}`;
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  files.forEach((file, index) => {
    parts.push(
      encoder.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="files[${index}]"; filename="${file.name}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`,
      ),
    );
    parts.push(new Uint8Array(file.data));
    parts.push(encoder.encode("\r\n"));
  });

  parts.push(
    encoder.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="payload_json"\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        JSON.stringify(payload) +
        `\r\n`,
    ),
  );

  parts.push(encoder.encode(`--${boundary}--\r\n`));

  const totalLength = parts.reduce((acc, part) => acc + part.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  return new Response(body, {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
  });
}
