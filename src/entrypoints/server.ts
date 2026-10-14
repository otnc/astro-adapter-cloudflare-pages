import type {
  ExecutionContext,
  Fetcher,
  IncomingRequestCfProperties,
  Request as WorkerRequest,
} from "@cloudflare/workers-types";
import { createApp } from "astro/app/entrypoint";
import { env as workerEnv } from "cloudflare:workers";
import { setGetEnv } from "astro/env/setup";
import type { PagesExecutionContext, Runtime } from "../types.js";
import { createGetEnv } from "../utils/env.js";

interface PagesEnv extends Record<string, unknown> {
  /** Static asset binding that Pages injects into every advanced-mode Worker. */
  ASSETS: Fetcher;
}

const PASS_THROUGH_UNSUPPORTED =
  "`passThroughOnException` is not available in Cloudflare Pages Functions. See https://developers.cloudflare.com/pages/platform/known-issues/#pages-functions.";

// Astro 6 validates astro:env secrets while modules load, before any request provides env, so read the module-scope bindings.
setGetEnv(createGetEnv(workerEnv));

const app = createApp();

// unstorage's Cloudflare drivers look a binding up by name on globalThis.__env__, so expose the one the session driver names.
function exposeSessionBinding(env: PagesEnv): void {
  const options = app.manifest.sessionConfig?.options as
    { binding?: unknown } | undefined;
  const bindingName = options?.binding;
  if (typeof bindingName !== "string" || !(bindingName in env)) return;
  const scope = globalThis as { __env__?: Record<string, unknown> };
  scope.__env__ ??= {};
  scope.__env__[bindingName] = env[bindingName];
}

function fetchAsset(env: PagesEnv, url: string): Promise<Response> {
  // Pages serves `/about.html` at `/about` and redirects the `.html` form, so ask for the canonical path.
  return env.ASSETS.fetch(
    url.replace(/index\.html$/, "").replace(/\.html$/, "")
  ) as unknown as Promise<Response>;
}

function createLocals(
  env: PagesEnv,
  request: WorkerRequest,
  context: ExecutionContext
): Runtime {
  const ctx: PagesExecutionContext = {
    waitUntil: (promise) => context.waitUntil(promise),
    passThroughOnException: () => {
      throw new Error(PASS_THROUGH_UNSUPPORTED);
    },
    props: {},
  };
  return {
    runtime: {
      env,
      cf: request.cf as IncomingRequestCfProperties | undefined,
      caches: (globalThis as unknown as Pick<Runtime["runtime"], "caches">)
        .caches,
      ctx,
    },
    cfContext: context,
  };
}

async function fetch(
  request: Request,
  env: PagesEnv,
  context: ExecutionContext
): Promise<Response> {
  exposeSessionBinding(env);

  const { pathname } = new URL(request.url);
  if (app.manifest.assets.has(pathname)) {
    return fetchAsset(env, request.url);
  }

  const routeData = app.match(request);
  if (!routeData) {
    const asset = await fetchAsset(env, request.url);
    if (asset.status !== 404) {
      return asset;
    }
  }

  return app.render(request, {
    routeData,
    locals: createLocals(env, request as unknown as WorkerRequest, context),
    clientAddress: request.headers.get("cf-connecting-ip") ?? undefined,
    waitUntil: (promise: Promise<unknown>) => context.waitUntil(promise),
    addCookieHeader: true,
    prerenderedErrorPageFetch: (url: string) => fetchAsset(env, url),
  });
}

export default { fetch };
