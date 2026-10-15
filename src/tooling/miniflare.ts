import type {
  MiniflareBindingOptions,
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
 * Starts the local runtime with Miniflare directly, so `astro dev` works without Wrangler. Miniflare does not read Wrangler or `cf` config files, so the bindings come from the `platformProxy.miniflare` option.
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
    const { Miniflare } = await import("miniflare");
    const { bindings, kvNamespaces, d1Databases, r2Buckets, persist } =
      options.miniflare ?? ({} satisfies MiniflareBindingOptions);

    const mf = new Miniflare({
      modules: true,
      script: IDLE_WORKER,
      compatibilityDate: COMPATIBILITY_DATE,
      ...(bindings && { bindings }),
      ...(kvNamespaces && { kvNamespaces }),
      ...(d1Databases && { d1Databases }),
      ...(r2Buckets && { r2Buckets }),
      ...(persist !== undefined && {
        kvPersist: persist,
        d1Persist: persist,
        r2Persist: persist,
      }),
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
