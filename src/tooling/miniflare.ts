import { loadMiniflare } from "./load-miniflare.js";
import { toMiniflareBindings } from "./miniflare-options.js";
import type {
  PlatformProxy,
  PlatformProxyOptions,
  PlatformProxyProvider,
} from "./platform-proxy.js";

// The Worker only exists to give Miniflare something to run; bindings are read from it, and no request ever reaches it.
const IDLE_WORKER =
  "export default { fetch() { return new Response(null, { status: 204 }); } };";
// Old enough for every Miniflare release; the idle Worker needs no newer behavior.
const COMPATIBILITY_DATE = "2025-01-01";

/**
 * Starts the local runtime with Miniflare directly, so `astro dev` works without Wrangler. Miniflare reads no config files, so the integration passes it the bindings of the Wrangler config merged with the `platformProxy.miniflare` option.
 *
 * @example
 * ```js
 * cloudflarePages({
 *   tool: "miniflare",
 *   platformProxy: { miniflare: { kvNamespaces: ["SESSION"], bindings: { GREETING: "hello" } } },
 * });
 * ```
 */
export const miniflareProvider: PlatformProxyProvider = {
  name: "miniflare",
  async start(options: PlatformProxyOptions): Promise<PlatformProxy> {
    const { create } = await loadMiniflare();

    const mf = create({
      modules: true,
      script: IDLE_WORKER,
      compatibilityDate: COMPATIBILITY_DATE,
      ...toMiniflareBindings(options.miniflare ?? {}),
    });

    try {
      const [env, cf, caches] = await Promise.all([
        mf.getBindings<Record<string, unknown>>(),
        mf.getCf(),
        mf.getCaches(),
      ]);
      const pending = new Set<Promise<unknown>>();
      return {
        env,
        cf,
        caches,
        ctx: {
          waitUntil(promise) {
            const tracked = promise.finally(() => pending.delete(tracked));
            pending.add(tracked);
          },
        },
        async dispose() {
          await Promise.allSettled(pending);
          await mf.dispose();
        },
      };
    } catch (error) {
      await mf.dispose();
      throw error;
    }
  },
};
