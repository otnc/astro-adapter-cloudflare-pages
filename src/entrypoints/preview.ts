import { existsSync, readFileSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { CreatePreviewServer } from "astro";
import type { MiniflareBindingOptions } from "../tooling/platform-proxy.js";
import { describeError, log } from "../log.js";
import { messages } from "../messages.js";
import { listFiles } from "../utils/files.js";
import { getPreviewOptions } from "../utils/preview-options.js";
import { headersFor, parseHeadersFile } from "../utils/static-headers.js";
import { parseStaticRedirects } from "../utils/static-redirects.js";

// Old enough for most Miniflare releases; a release that supports fewer dates reports its newest one, and the start is retried with it.
const COMPATIBILITY_DATE = "2026-08-01";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

/** Every module of the Worker, declared one by one because Miniflare cannot follow the dynamic imports in the bundle. `.wasm` files are the WebAssembly modules that `cloudflareModules` emits. */
async function listModules(
  workerDir: string
): Promise<{ type: "ESModule" | "CompiledWasm"; path: string }[]> {
  const modules: { type: "ESModule" | "CompiledWasm"; path: string }[] = [];
  for (const file of await listFiles(workerDir)) {
    const path = join(workerDir, file);
    if (/\.m?js$/.test(file)) modules.push({ type: "ESModule", path });
    else if (file.endsWith(".wasm"))
      modules.push({ type: "CompiledWasm", path });
  }
  // Miniflare runs the first module as the entry.
  const entry = join(workerDir, "index.js");
  return modules.sort(
    (a, b) => Number(b.path === entry) - Number(a.path === entry)
  );
}

function findFile(root: string, pathname: string): string | undefined {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidates =
    clean === ""
      ? ["index.html"]
      : [clean, `${clean}.html`, join(clean, "index.html")];
  for (const candidate of candidates) {
    if (candidate.split(/[\\/]/).includes("..")) continue;
    if (candidate.startsWith("_worker.js")) continue;
    const file = join(root, candidate);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

async function startMiniflare(
  workerDir: string,
  outDir: string,
  options: MiniflareBindingOptions
) {
  const { Miniflare, Response } = await import("miniflare");
  // Pages applies _headers to the static files it serves, so the stand-in binding does too.
  const headersFile = join(outDir, "_headers");
  const headerRules = existsSync(headersFile)
    ? parseHeadersFile(readFileSync(headersFile, "utf-8"))
    : [];
  const modules = await listModules(workerDir);
  const create = (compatibilityDate: string) =>
    new Miniflare({
      modules,
      modulesRoot: workerDir,
      compatibilityDate,
      ...(options.compatibilityFlags && {
        compatibilityFlags: options.compatibilityFlags,
      }),
      ...(options.bindings && { bindings: options.bindings }),
      ...(options.kvNamespaces && { kvNamespaces: options.kvNamespaces }),
      ...(options.d1Databases && { d1Databases: options.d1Databases }),
      ...(options.r2Buckets && { r2Buckets: options.r2Buckets }),
      ...(options.persist !== undefined && {
        kvPersist: options.persist,
        d1Persist: options.persist,
        r2Persist: options.persist,
      }),
      serviceBindings: {
        // Stands in for the static asset binding that Pages gives every _worker.js.
        ASSETS: (request: { url: string }) => {
          const { pathname } = new URL(request.url);
          const file = findFile(outDir, pathname);
          if (!file) return new Response("Not found", { status: 404 });
          const headers: Record<string, string> = {
            "content-type":
              CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
          };
          for (const [name, value] of headersFor(headerRules, pathname)) {
            headers[name] = value;
          }
          return new Response(readFileSync(file), { headers });
        },
      },
    });

  const wanted = options.compatibilityDate ?? COMPATIBILITY_DATE;
  let mf = create(wanted);
  try {
    await mf.ready;
  } catch (error) {
    await mf.dispose().catch(() => {});
    const newest =
      /newest date supported by this server binary is "(\d{4}-\d{2}-\d{2})"/.exec(
        String(error instanceof Error ? error.message : error)
      )?.[1];
    if (!newest || options.compatibilityDate) throw error;
    mf = create(newest);
    await mf.ready;
  }
  return mf;
}

/** The arguments of `dispatchFetch()`, which takes a URL and request options rather than a Request. */
function toFetchArgs(
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

async function send(response: Response, reply: ServerResponse): Promise<void> {
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

/**
 * `astro preview` for Cloudflare Pages: serves the build in Miniflare, the runtime Pages uses, with the static files behind an `ASSETS` binding and the static rules of `_redirects` applied first. Bindings come from the `platformProxy.miniflare` option.
 */
const createPreviewServer: CreatePreviewServer = async (params) => {
  const { logger } = params;
  const outDir = fileURLToPath(params.outDir);
  const workerDir = fileURLToPath(params.server);
  if (!existsSync(join(workerDir, "index.js"))) {
    throw new Error(messages.noBuildOutput);
  }

  const options = getPreviewOptions();
  if (!options) {
    log.warn(logger, messages.noPreviewBindings);
  }
  const mf = await startMiniflare(workerDir, outDir, options ?? {});

  const redirectsFile = join(outDir, "_redirects");
  const redirects = existsSync(redirectsFile)
    ? parseStaticRedirects(readFileSync(redirectsFile, "utf-8"))
    : new Map();

  const server = createServer((message, reply) => {
    void (async () => {
      try {
        const origin = `http://${message.headers.host ?? "localhost"}`;
        const rule = redirects.get(
          new URL(message.url ?? "/", origin).pathname
        );
        if (rule) {
          reply.writeHead(rule.status, { location: rule.location });
          return void reply.end();
        }
        const [url, init] = toFetchArgs(message, origin);
        // Miniflare types its own RequestInit; the standard one is accepted at runtime.
        const response = await mf.dispatchFetch(url, init as never);
        for (const [name, value] of Object.entries(params.headers ?? {})) {
          if (value !== undefined) response.headers.set(name, String(value));
        }
        await send(response as unknown as Response, reply);
      } catch (error) {
        log.error(logger, describeError(error));
        if (!reply.headersSent) reply.writeHead(500);
        reply.end();
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(params.port, params.host, resolve);
  });
  const closed = new Promise<void>((resolve) => server.once("close", resolve));
  log.info(
    logger,
    messages.previewListening(
      `http://${params.host ?? "localhost"}:${params.port}${params.base}`
    )
  );

  return {
    host: params.host,
    port: params.port,
    closed: () => closed,
    async stop() {
      server.close();
      server.closeAllConnections();
      await mf.dispose();
    },
  };
};

export default createPreviewServer;
