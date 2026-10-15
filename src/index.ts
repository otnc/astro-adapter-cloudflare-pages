import type {
  AstroConfig,
  AstroIntegration,
  IntegrationResolvedRoute,
} from "astro";
import { appendRedirects } from "./build/redirects-file.js";
import { writeHeadersFile } from "./build/headers-file.js";
import { writeRoutesFile } from "./build/routes-file.js";
import { inlineEntryFacades } from "./build/server-bundle.js";
import {
  cloudflareImportsPlugin,
  configureWorkerBuild,
} from "./build/worker-vite.js";
import {
  assertSupportedAstro,
  resolveCompat,
  type ResolvedCompat,
} from "./compat/index.js";
import { connectDevRuntime } from "./dev/runtime.js";
import { log } from "./log.js";
import { messages } from "./messages.js";
import {
  DEFAULT_SESSION_KV_BINDING_NAME,
  PACKAGE_NAME,
  type Options,
} from "./options.js";
import {
  CF_CONFIG_FILES,
  WRANGLER_CONFIG_FILES,
  detectTool,
  startPlatformProxy,
  type Tool,
} from "./tooling/index.js";
import { cloudflareModulesPlugin } from "./utils/cloudflare-modules.js";
import { withSlashes } from "./utils/files.js";
import { resolveImageSetup, swapSharpInWorker } from "./utils/image-config.js";
import { loadBindingOptions } from "./utils/miniflare-bindings.js";
import { setPreviewOptions } from "./utils/preview-options.js";
import { toHeaderRules, type HeaderRule } from "./utils/static-headers.js";

export type { Options, RouteRule } from "./options.js";
export type { Runtime, PagesExecutionContext } from "./types.js";

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
  let compat: ResolvedCompat;
  let routes: IntegrationResolvedRoute[] = [];
  let headerRules: HeaderRule[] = [];

  return {
    name: PACKAGE_NAME,
    hooks: {
      "astro:config:setup": ({
        config: userConfig,
        updateConfig,
        logger,
        addWatchFile,
        command,
      }) => {
        compat = resolveCompat(userConfig.root);
        assertSupportedAstro(
          compat,
          options.unsafe?.allowUntestedAstro ?? false,
          logger
        );

        let session = userConfig.session;
        if (session !== false && !session?.driver) {
          log.info(logger, messages.enablingSessions(sessionKVBindingName));
          session = compat.createKVSessionConfig(sessionKVBindingName, session);
        }

        const image = resolveImageSetup(
          options.imageService,
          userConfig,
          command,
          logger
        );
        updateConfig({
          ...(image.service && { image: { service: image.service } }),
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
            // Bundle this package in every server environment, prerendering included, so Vite processes the image service (`import.meta.env.BASE_URL`).
            ssr: { noExternal: [PACKAGE_NAME] },
            plugins: [
              ...(image.swapSharpInWorker ? [swapSharpInWorker()] : []),
              cloudflareImportsPlugin(),
              ...((options.cloudflareModules ?? true)
                ? [cloudflareModulesPlugin()]
                : []),
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

      "astro:config:done": ({ setAdapter, config: finalConfig, logger }) => {
        config = finalConfig;
        setPreviewOptions(
          loadBindingOptions(config, options.platformProxy, logger)
        );
        setAdapter({
          name: PACKAGE_NAME,
          entrypointResolution: "auto",
          serverEntrypoint: new URL(
            "./entrypoints/server.mjs",
            import.meta.url
          ),
          // Resolved by package name, because Astro passes the string to require.resolve().
          previewEntrypoint: `${PACKAGE_NAME}/preview`,
          adapterFeatures: {
            buildOutput: "server",
            middlewareMode: "classic",
            staticHeaders: options.staticHeaders ?? true,
          },
          supportedAstroFeatures: {
            serverOutput: "stable",
            hybridOutput: "stable",
            staticOutput: "unsupported",
            i18nDomains: "experimental",
            sharpImageService: {
              support: "limited",
              message: messages.sharpUnsupported,
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
          {
            ...options.platformProxy,
            ...(tool === "miniflare" && {
              miniflare: loadBindingOptions(
                config,
                options.platformProxy,
                logger
              ),
            }),
          },
          logger
        );
        if (!proxy) return;
        connectDevRuntime({ server, proxy, config, sessionKVBindingName });
      },

      "astro:build:setup": ({ vite, target }) => {
        if (target === "server") configureWorkerBuild(vite, compat);
      },

      "astro:build:generated": ({ routeToHeaders }) => {
        headerRules = toHeaderRules(routeToHeaders, {
          trailingSlash: config.build.format === "directory",
        });
      },

      "astro:build:done": async ({ pages, dir, logger, assets }) => {
        await inlineEntryFacades(new URL("./_worker.js/", config.outDir));
        await writeHeadersFile(config.outDir, headerRules, logger);
        await writeRoutesFile({
          config,
          routes,
          prerenderedPathnames: pages.map((page) => page.pathname),
          extend: options.routes?.extend,
          logger,
        });
        await appendRedirects({ config, routes, dir, assets });
      },
    },
  };
}
