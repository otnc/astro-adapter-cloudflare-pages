import type { AstroConfig, HookParameters } from "astro";
import type { PlatformProxy } from "../tooling/platform-proxy.js";
import type { Runtime } from "../types.js";
import { createGetEnv } from "../utils/env.js";
import { createRuntimeLocals } from "../utils/runtime-locals.js";

interface DevRuntimeInput {
  server: HookParameters<"astro:server:setup">["server"];
  proxy: PlatformProxy;
  config: AstroConfig;
  sessionKVBindingName: string;
}

/**
 * Connects `astro dev` to the platform proxy: the session binding for the KV driver, the `astro:env` variables of the schema, and `Astro.locals` for every request.
 */
export function connectDevRuntime(input: DevRuntimeInput): void {
  const { server, proxy, config, sessionKVBindingName } = input;
  server.httpServer?.on("close", () => {
    void proxy.dispose();
  });

  // unstorage's Cloudflare drivers look a binding up by name on globalThis.__env__.
  const scope = globalThis as { __env__?: Record<string, unknown> };
  scope.__env__ ??= {};
  scope.__env__[sessionKVBindingName] = proxy.env[sessionKVBindingName];

  // In dev, astro:env reads process.env, so copy the variables the schema declares from the bindings.
  const getEnv = createGetEnv(proxy.env);
  for (const key of Object.keys(config.env?.schema ?? {})) {
    const value = getEnv(key);
    if (value !== undefined) process.env[key] = value;
  }

  const locals = createRuntimeLocals({
    env: proxy.env,
    cf: proxy.cf as Runtime["runtime"]["cf"],
    caches: proxy.caches as Runtime["runtime"]["caches"],
    context: proxy.ctx,
  });
  const clientLocalsSymbol = Symbol.for("astro.locals");
  server.middlewares.use((req, _res, next) => {
    Reflect.set(req, clientLocalsSymbol, locals);
    next();
  });
}
