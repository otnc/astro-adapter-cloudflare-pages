import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";

/** The arguments of `dispatchFetch()`, which takes a URL and request options rather than a Request. */
export function toFetchArgs(
  message: IncomingMessage,
  origin: string
): [url: URL, init: Record<string, unknown>] {
  const headers = new Headers();
  for (const [name, value] of Object.entries(message.headers)) {
    if (Array.isArray(value))
      value.forEach((entry) => headers.append(name, entry));
    else if (value !== undefined) headers.set(name, value);
  }
  // Cloudflare sets this header on every request, and Astro.clientAddress reads it.
  headers.set("cf-connecting-ip", message.socket.remoteAddress ?? "127.0.0.1");
  const hasBody = message.method !== "GET" && message.method !== "HEAD";
  return [
    new URL(message.url ?? "/", origin),
    {
      method: message.method,
      headers,
      ...(hasBody && { body: Readable.toWeb(message), duplex: "half" }),
    },
  ];
}

/** Writes a fetch Response to a Node.js response, keeping every `Set-Cookie` header. */
export async function send(
  response: Response,
  reply: ServerResponse
): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie") headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) headers["set-cookie"] = cookies;
  reply.writeHead(response.status, headers);
  if (!response.body) return void reply.end();
  Readable.fromWeb(response.body as never).pipe(reply);
}
