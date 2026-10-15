import { appendFile } from "node:fs/promises";
import {
  createRedirectsFromAstroRoutes,
  printAsRedirects,
} from "@astrojs/underscore-redirects";
import type {
  AstroConfig,
  HookParameters,
  IntegrationResolvedRoute,
} from "astro";

interface RedirectsFileInput {
  config: AstroConfig;
  routes: IntegrationResolvedRoute[];
  dir: URL;
  assets: HookParameters<"astro:build:done">["assets"];
}

/**
 * Appends Astro's static redirects to `_redirects`. Dynamic ones such as `/blog/[slug]` are left to the Worker, because `@astrojs/underscore-redirects` would map them to a prerendered file instead of the destination.
 */
export async function appendRedirects(
  input: RedirectsFileInput
): Promise<void> {
  const { config, routes, dir, assets } = input;
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
  if (redirects.empty()) return;
  await appendFile(
    new URL("./_redirects", config.outDir),
    printAsRedirects(redirects),
    "utf-8"
  );
}
