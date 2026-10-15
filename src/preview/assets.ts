import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { headersFor, parseHeadersFile } from "../utils/static-headers.js";

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

/** The file that Pages serves for a path: the file itself, `<path>.html`, or `<path>/index.html`. */
export function findFile(root: string, pathname: string): string | undefined {
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

/** Serves the static files of the build for the `ASSETS` binding, with the rules of `_headers` applied as Pages does. */
export function createAssetsBinding(
  outDir: string,
  Response: typeof globalThis.Response
) {
  const headersFile = join(outDir, "_headers");
  const headerRules = existsSync(headersFile)
    ? parseHeadersFile(readFileSync(headersFile, "utf-8"))
    : [];
  return (request: { url: string }) => {
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
  };
}
