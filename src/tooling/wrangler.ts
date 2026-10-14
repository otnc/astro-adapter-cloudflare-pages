import type {
  PlatformProxy,
  PlatformProxyOptions,
  PlatformProxyProvider,
} from "./platform-proxy.js";

/** Starts the local runtime with Wrangler's `getPlatformProxy()`, which reads the bindings from the project's Wrangler config. */
export const wranglerProvider: PlatformProxyProvider = {
  name: "wrangler",
  async start(options: PlatformProxyOptions): Promise<PlatformProxy> {
    const { getPlatformProxy } = await import("wrangler");
    const proxy = await getPlatformProxy({
      configPath: options.configPath,
      environment: options.environment,
      persist: options.persist,
    });
    return {
      env: proxy.env,
      cf: proxy.cf,
      caches: proxy.caches,
      ctx: { waitUntil: (promise) => proxy.ctx.waitUntil(promise) },
      dispose: () => proxy.dispose(),
    };
  },
};
