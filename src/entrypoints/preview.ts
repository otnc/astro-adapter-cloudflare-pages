import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CreatePreviewServer } from "astro";
import { describeError, log } from "../log.js";
import { messages } from "../messages.js";
import { toFetchArgs, send } from "../preview/http.js";
import { startWorker } from "../preview/worker.js";
import { hasBindings } from "../tooling/miniflare-options.js";
import { getPreviewOptions } from "../utils/preview-options.js";
import { parseStaticRedirects } from "../utils/static-redirects.js";

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
  if (!options || !hasBindings(options)) {
    log.warn(logger, messages.noPreviewBindings);
  }
  const mf = await startWorker(workerDir, outDir, options ?? {});

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
