import { existsSync } from "node:fs";
import { log, type Logger } from "../log.js";
import { messages } from "../messages.js";
import type { PlatformProxy, PlatformProxyOptions } from "./platform-proxy.js";
import { miniflareProvider } from "./miniflare.js";
import { wranglerProvider } from "./wrangler.js";

export type Tool = "wrangler" | "cf" | "miniflare";
export type ToolOption = Tool | "auto";

export const WRANGLER_CONFIG_FILES = [
  "wrangler.jsonc",
  "wrangler.json",
  "wrangler.toml",
];
export const CF_CONFIG_FILES = [
  "cloudflare.config.ts",
  "cloudflare.config.mts",
  "cloudflare.config.js",
  "cloudflare.config.mjs",
];

/**
 * Decides which tool the project uses. `"miniflare"` is never detected, because Miniflare reads no config file; it is chosen explicitly. `"auto"` prefers a `cloudflare.config.*` file (the `cf` CLI), then a `wrangler.*` file, and defaults to Wrangler.
 */
export function detectTool(option: ToolOption, root: URL): Tool {
  if (option !== "auto") return option;
  const has = (files: string[]) =>
    files.some((file) => existsSync(new URL(file, root)));
  if (has(CF_CONFIG_FILES)) return "cf";
  if (has(WRANGLER_CONFIG_FILES)) return "wrangler";
  return "wrangler";
}

/**
 * Starts the local Cloudflare runtime for `astro dev`, or returns `undefined` when it cannot.
 *
 * The `cf` CLI (1.0.0-beta.17) has no programmatic local runtime yet, so `cf` projects use Wrangler's runtime when Wrangler is installed. `tool: "miniflare"` starts Miniflare directly instead, without Wrangler.
 */
export async function startPlatformProxy(
  tool: Tool,
  options: PlatformProxyOptions,
  logger: Logger
): Promise<PlatformProxy | undefined> {
  const useMiniflare = tool === "miniflare";
  try {
    const proxy = await (
      useMiniflare ? miniflareProvider : wranglerProvider
    ).start(options);
    if (tool === "cf") {
      log.warn(logger, messages.cfRuntimeUnavailable);
    }
    return proxy;
  } catch (error) {
    if (!isModuleNotFound(error)) throw error;
    if (useMiniflare) {
      log.warn(logger, messages.miniflareMissing);
      return undefined;
    }
    log.warn(
      logger,
      tool === "cf"
        ? messages.cfRuntimeUnavailableWithoutWrangler
        : messages.wranglerMissing
    );
    return undefined;
  }
}

function isModuleNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ERR_MODULE_NOT_FOUND" || error.code === "MODULE_NOT_FOUND")
  );
}
