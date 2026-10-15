import type { Target } from "./build/layout.js";
import type { ToolOption } from "./tooling/index.js";
import type { PlatformProxyOptions } from "./tooling/platform-proxy.js";
import type { ImageServiceOption } from "./utils/image-config.js";

export const PACKAGE_NAME = "astro-adapter-cloudflare-pages";
export const DEFAULT_SESSION_KV_BINDING_NAME = "SESSION";

export interface RouteRule {
  /** A `_routes.json` pattern such as `/api/*`. */
  pattern: string;
}

export interface Options {
  /**
   * Tool whose config and local runtime the adapter uses. `"auto"` picks `cf` when a `cloudflare.config.*` file exists, and Wrangler otherwise. `"miniflare"` runs Miniflare directly, without Wrangler; it takes bindings from the Wrangler config file (`wrangler.jsonc`, `wrangler.json` or `wrangler.toml`) and from `platformProxy.miniflare`.
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
  /** Emulates Cloudflare bindings in `astro dev` with the tool's local runtime (Wrangler or Miniflare). */
  platformProxy?: PlatformProxyOptions & {
    /** @default true */
    enabled?: boolean;
  };
  /**
   * KV binding used by the default session driver when `session.driver` is not set.
   * @default "SESSION"
   */
  sessionKVBindingName?: string;
  /**
   * How images are optimized. sharp cannot run on Cloudflare, so on-demand pages never use it.
   *
   * - `"compile"`: optimize images of prerendered pages with sharp at build time, and serve images of on-demand pages unchanged.
   * - `"passthrough"`: never optimize.
   * - `"cloudflare"`: resize through Cloudflare Images transformations (`/cdn-cgi/image/`), which must be enabled on the zone. `astro dev` keeps sharp.
   * - `"custom"`: use `image.service` as configured.
   *
   * A non-sharp `image.service` is always kept.
   * @default "compile"
   */
  imageService?: ImageServiceOption;
  /**
   * Writes the headers Astro computes for static pages, such as the Content-Security-Policy of `security.csp`, to `_headers`, so Pages sends them. Rules you put in `public/_headers` are kept. Turn it off to let Astro put the policy in a `<meta>` tag instead.
   * @default true
   */
  staticHeaders?: boolean;
  /**
   * Lets pages and endpoints import `.wasm` (also `.wasm?module`), `.bin` and `.txt` files, as `@astrojs/cloudflare` v12 did. A `.wasm` file becomes a file next to the Worker bundle, which is how WebAssembly loads on Cloudflare; `.bin` gives an `ArrayBuffer` and `.txt` a string.
   * @default true
   */
  cloudflareModules?: boolean;
  /**
   * A Worker entry that replaces the adapter's, as `workerEntryPoint` did in `@astrojs/cloudflare` v12. The path is relative to the project root. The module default-exports the Worker (`{ fetch }`), and calls the adapter's handler, which `astro-adapter-cloudflare-pages/handler` exports, for the requests it does not answer itself. Pages Workers run `fetch` only, so scheduled and queue handlers are not supported.
   */
  workerEntryPoint?: string;
  /**
   * Where the build runs.
   *
   * - `"pages"`: Cloudflare Pages, with the Worker in `dist/_worker.js/` and `_routes.json`.
   * - `"workers"`: Workers with static assets. The Worker is `dist/server/index.js` and the static files are in `dist/client/`; point `main` and `assets.directory` of your Wrangler config at them, and name the assets binding `ASSETS`.
   * @default "pages"
   */
  target?: Target;
  /** Escape hatches. Everything here is unsupported. */
  unsafe?: {
    /** Lets the build continue on an Astro major that this version of the adapter has not been tested with. */
    allowUntestedAstro?: boolean;
  };
}
