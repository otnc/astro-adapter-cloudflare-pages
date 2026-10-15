import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AstroConfig, IntegrationResolvedRoute } from "astro";
import { log, type Logger } from "../log.js";
import { messages } from "../messages.js";
import type { Options } from "../options.js";
import { fileExists, listFiles, readTextFile } from "../utils/files.js";
import { createRoutesJson } from "../utils/routes-json.js";

/** The source paths of the rules in a `_redirects` file. */
async function readRedirectSources(redirectsFile: URL): Promise<string[]> {
  const content = await readTextFile(redirectsFile);
  if (!content) return [];
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => parts[0]!);
}

interface RoutesFileInput {
  config: AstroConfig;
  routes: IntegrationResolvedRoute[];
  /** Pathnames of the pages Astro prerendered. */
  prerenderedPathnames: string[];
  extend: NonNullable<Options["routes"]>["extend"];
  logger: Logger;
}

/** Writes `_routes.json`, unless the project provides its own in `public/`. */
export async function writeRoutesFile(input: RoutesFileInput): Promise<void> {
  const { config, routes, extend, logger } = input;
  const routesFile = new URL("./_routes.json", config.outDir);
  if (await fileExists(routesFile)) {
    log.info(logger, messages.keepingRoutesFile);
    return;
  }

  const routesJson = createRoutesJson({
    base: config.base,
    assetsDir: config.build.assets,
    publicFiles: await listFiles(fileURLToPath(config.publicDir)),
    routes,
    prerenderedPathnames: input.prerenderedPathnames,
    redirectSources: await readRedirectSources(
      new URL("./_redirects", config.outDir)
    ),
    extendInclude: extend?.include?.map((rule) => rule.pattern),
    extendExclude: extend?.exclude?.map((rule) => rule.pattern),
  });
  await writeFile(
    routesFile,
    `${JSON.stringify(routesJson, null, 2)}\n`,
    "utf-8"
  );
}
