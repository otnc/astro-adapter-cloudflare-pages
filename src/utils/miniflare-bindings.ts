import type { AstroConfig } from "astro";
import { fileURLToPath } from "node:url";
import { describeError, log, type Logger } from "../log.js";
import { messages } from "../messages.js";
import type { PlatformProxyOptions } from "../tooling/platform-proxy.js";
import {
  findWranglerConfig,
  mergeBindingOptions,
  resolveBindingOptions,
} from "../tooling/wrangler-config.js";

/**
 * The bindings for Miniflare (`tool: "miniflare"` and `astro preview`): what the Wrangler config declares, overridden by `platformProxy.miniflare`. A config file that cannot be parsed is reported and ignored.
 */
export function loadBindingOptions(
  config: Pick<AstroConfig, "root">,
  platformProxy: PlatformProxyOptions | undefined,
  logger: Logger
) {
  const root = fileURLToPath(config.root);
  try {
    return resolveBindingOptions({
      root,
      configPath: platformProxy?.configPath,
      environment: platformProxy?.environment,
      explicit: platformProxy?.miniflare,
    });
  } catch (error) {
    const file =
      findWranglerConfig(root, platformProxy?.configPath) ?? "the config file";
    log.warn(
      logger,
      messages.wranglerConfigInvalid(file, describeError(error))
    );
    return mergeBindingOptions({}, platformProxy?.miniflare);
  }
}
