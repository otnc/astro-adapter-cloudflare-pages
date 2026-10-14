import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  createRedirectsFromAstroRoutes,
  printAsRedirects,
} from "@astrojs/underscore-redirects";
import type {
  AstroConfig,
  AstroIntegration,
  AstroIntegrationLogger,
  IntegrationResolvedRoute,
} from "astro";
import { passthroughImageService } from "astro/config";
import { assertSupportedAstro, resolveCompat } from "./compat/index.js";
import type { PlatformProxyOptions } from "./tooling/platform-proxy.js";
import {
  CF_CONFIG_FILES,
  WRANGLER_CONFIG_FILES,
  detectTool,
  startPlatformProxy,
  type Tool,
  type ToolOption,
} from "./tooling/index.js";
import { createGetEnv } from "./utils/env.js";
import { createRoutesJson } from "./utils/routes-json.js";

export type { Runtime, PagesExecutionContext } from "./types.js";

export interface RouteRule {
  /** A `_routes.json` pattern such as `/api/*`. */
  pattern: string;
}

export interface Options {
  /**
   * Deploy tool whose config and local runtime the adapter uses. `"auto"` picks `cf` when a `cloudflare.config.*` file exists, and Wrangler otherwise.
   * @default "auto"
   */
  tool?: ToolOption;
  /** Adds rules to the generated `_routes.json`. Ignored when `public/_routes.json` exists. */
  routes?: {
    extend?: {
      include?: RouteRule[];
      exclude?: RouteRule[];
    };
  };
  /** Emulates Cloudflare bindings in `astro dev` with the deploy tool's local runtime (Wrangler). */
  platformProxy?: PlatformProxyOptions & {
    /** @default true */
    enabled?: boolean;
  };
  /**
   * KV binding used by the default session driver when `session.driver` is not set.
   * @default "SESSION"
   */
  sessionKVBindingName?: string;
  /** Escape hatches. Everything here is unsupported. */
  unsafe?: {
    /** Lets the build continue on an Astro major that this version of the adapter has not been tested with. */
    allowUntestedAstro?: boolean;
  };
}

const PACKAGE_NAME = "astro-adapter-cloudflare-pages";
const SHARP_SERVICE_ENTRYPOINT = "astro/assets/services/sharp";
const DEFAULT_SESSION_KV_BINDING_NAME = "SESSION";
const PASS_THROUGH_UNSUPPORTED =
  "`passThroughOnException` is not available in Cloudflare Pages Functions. See https://developers.cloudflare.com/pages/platform/known-issues/#pages-functions.";

function withSlashes(path: string): string {
  return `/${path}/`.replace(/\/+/g, "/");
}

async function fileExists(url: URL): Promise<boolean> {
  try {
    await readFile(url);
    return true;
  } catch {
    return false;
  }
}

async function listPublicFiles(publicDir: URL): Promise<string[]> {
  try {
    const entries = await readdir(publicDir, {
      recursive: true,
      withFileTypes: true,
    });
    const root = fileURLToPath(publicDir);
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        `${entry.parentPath}/${entry.name}`
          .slice(root.length)
          .replace(/\\/g, "/")
          .replace(/^\/+/, "")
      );
  } catch {
    return [];
  }
}

// sharp cannot run in workerd, so Astro's default image service would break on-demand pages.
function resolveImageService(
  config: AstroConfig,
  logger: AstroIntegrationLogger
): ReturnType<typeof passthroughImageService> | undefined {
  if (config.image.service.entrypoint !== SHARP_SERVICE_ENTRYPOINT) {
    return undefined;
  }
  logger.info(
    "Cloudflare Pages cannot run sharp, so images are served without optimization (passthrough image service)."
  );
  return passthroughImageService();
}

async function readRedirectSources(redirectsFile: URL): Promise<string[]> {
  try {
    const content = await readFile(redirectsFile, "utf-8");
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 2)
      .map((parts) => parts[0]!);
  } catch {
    return [];
  }
}

/**
 * Creates the Astro integration that builds on-demand rendered sites for Cloudflare Pages advanced mode (`_worker.js`).
 *
 * @example
 * ```js
 * // astro.config.mjs
 * import { defineConfig } from "astro/config";
 * import cloudflarePages from "astro-adapter-cloudflare-pages";
 *
 * export default defineConfig({
 *   adapter: cloudflarePages(),
 * });
 * ```
 */
export default function cloudflarePages(
  options: Options = {}
): AstroIntegration {
  const sessionKVBindingName =
    options.sessionKVBindingName ?? DEFAULT_SESSION_KV_BINDING_NAME;
  let config: AstroConfig;
  let tool: Tool = "wrangler";
  let routes: IntegrationResolvedRoute[] = [];

  return {
    name: PACKAGE_NAME,
    hooks: {
      "astro:config:setup": ({
        config: userConfig,
        updateConfig,
        logger,
        addWatchFile,
      }) => {
        const compat = resolveCompat(userConfig.root);
        assertSupportedAstro(
          compat,
          options.unsafe?.allowUntestedAstro ?? false,
          logger
        );

        let session = userConfig.session;
        if (session !== false && !session?.driver) {
          logger.info(
            `Enabling sessions with Cloudflare KV using the "${sessionKVBindingName}" binding. Add a KV namespace with that binding to your Pages project to use sessions.`
          );
          session = compat.createKVSessionConfig(sessionKVBindingName, session);
        }

        const imageService = resolveImageService(userConfig, logger);
        updateConfig({
          ...(imageService && { image: { service: imageService } }),
          session,
          build: {
            client: new URL(
              `.${withSlashes(userConfig.base)}`,
              userConfig.outDir
            ),
            server: new URL("./_worker.js/", userConfig.outDir),
            serverEntry: "index.js",
            redirects: false,
          },
          vite: {
            plugins: [
              {
                name: `${PACKAGE_NAME}:cloudflare-imports`,
                enforce: "pre",
                resolveId(source) {
                  return source.startsWith("cloudflare:")
                    ? { id: source, external: true }
                    : null;
                },
              },
            ],
          },
        });

        tool = detectTool(options.tool ?? "auto", userConfig.root);
        const configPath = options.platformProxy?.configPath;
        const watched = configPath
          ? [configPath]
          : [...WRANGLER_CONFIG_FILES, ...CF_CONFIG_FILES];
        for (const file of watched) {
          addWatchFile(new URL(file, userConfig.root));
        }
      },

      "astro:routes:resolved": ({ routes: resolved }) => {
        routes = resolved;
      },

      "astro:config:done": ({ setAdapter, config: finalConfig }) => {
        config = finalConfig;
        setAdapter({
          name: PACKAGE_NAME,
          entrypointResolution: "auto",
          serverEntrypoint: new URL(
            "./entrypoints/server.mjs",
            import.meta.url
          ),
          adapterFeatures: {
            buildOutput: "server",
            middlewareMode: "classic",
          },
          supportedAstroFeatures: {
            serverOutput: "stable",
            hybridOutput: "stable",
            staticOutput: "unsupported",
            i18nDomains: "experimental",
            sharpImageService: {
              support: "limited",
              message:
                "Cloudflare Pages cannot run sharp at request time, so the adapter switches the default image service to passthrough.",
              suppress: "default",
            },
            envGetSecret: "stable",
          },
        });
      },

      "astro:server:setup": async ({ server, logger }) => {
        if (options.platformProxy?.enabled === false) return;
        const proxy = await startPlatformProxy(
          tool,
          options.platformProxy ?? {},
          logger
        );
        if (!proxy) return;
        server.httpServer?.on("close", () => {
          void proxy.dispose();
        });

        const scope = globalThis as { __env__?: Record<string, unknown> };
        scope.__env__ ??= {};
        scope.__env__[sessionKVBindingName] = proxy.env[sessionKVBindingName];

        // In dev, astro:env reads process.env, so copy the variables the schema declares from the bindings.
        const getEnv = createGetEnv(proxy.env);
        for (const key of Object.keys(config.env?.schema ?? {})) {
          const value = getEnv(key);
          if (value !== undefined) process.env[key] = value;
        }

        const clientLocalsSymbol = Symbol.for("astro.locals");
        server.middlewares.use((req, _res, next) => {
          Reflect.set(req, clientLocalsSymbol, {
            runtime: {
              env: proxy.env,
              cf: proxy.cf,
              caches: proxy.caches,
              ctx: {
                waitUntil: (promise: Promise<unknown>) =>
                  proxy.ctx.waitUntil(promise),
                passThroughOnException: () => {
                  throw new Error(PASS_THROUGH_UNSUPPORTED);
                },
                props: {},
              },
            },
            cfContext: proxy.ctx,
          });
          next();
        });
      },

      "astro:build:setup": ({ vite, target }) => {
        if (target !== "server") return;
        vite.ssr ??= {};
        vite.ssr.target = "webworker";
        vite.ssr.noExternal = true;
        vite.ssr.resolve ??= {};
        vite.ssr.resolve.conditions = [
          "workerd",
          "worker",
          "browser",
          "module",
          "import",
          "default",
        ];
      },

      "astro:build:done": async ({ pages, dir, logger, assets }) => {
        const redirectsFile = new URL("./_redirects", config.outDir);
        const routesFile = new URL("./_routes.json", config.outDir);

        if (await fileExists(routesFile)) {
          logger.info(
            "Keeping the existing _routes.json instead of generating one."
          );
        } else {
          const routesJson = createRoutesJson({
            base: config.base,
            assetsDir: config.build.assets,
            publicFiles: await listPublicFiles(config.publicDir),
            routes,
            prerenderedPathnames: pages.map((page) => page.pathname),
            redirectSources: await readRedirectSources(redirectsFile),
            extendInclude: options.routes?.extend?.include?.map(
              (rule) => rule.pattern
            ),
            extendExclude: options.routes?.extend?.exclude?.map(
              (rule) => rule.pattern
            ),
          });
          await writeFile(
            routesFile,
            `${JSON.stringify(routesJson, null, 2)}\n`,
            "utf-8"
          );
        }

        const redirects = createRedirectsFromAstroRoutes({
          config,
          routeToDynamicTargetMap: new Map(
            routes
              .filter((route) => route.type === "redirect" && route.pathname)
              .map((route) => [route, ""])
          ),
          dir,
          buildOutput: "server",
          assets,
        });
        if (!redirects.empty()) {
          await appendFile(redirectsFile, printAsRedirects(redirects), "utf-8");
        }
      },
    },
  };
}
