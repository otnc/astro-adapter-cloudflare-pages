/**
 * The local Cloudflare runtime that `astro dev` uses to emulate bindings. Each deploy tool (Wrangler now, the `cf` CLI later) implements this, so the integration hooks never depend on a specific tool.
 */
export interface PlatformProxy {
  env: Record<string, unknown>;
  cf: unknown;
  caches: unknown;
  ctx: {
    waitUntil(promise: Promise<unknown>): void;
  };
  dispose(): Promise<void>;
}

/** Bindings for the Miniflare provider, which the Wrangler config file also supplies. */
export interface MiniflareBindingOptions {
  /** Plain variables and secrets. */
  bindings?: Record<string, string | number | boolean>;
  /** Names of KV namespace bindings to create. */
  kvNamespaces?: string[];
  /** Names of D1 database bindings to create. */
  d1Databases?: string[];
  /** Names of R2 bucket bindings to create. */
  r2Buckets?: string[];
  /** Compatibility date of the Worker in `astro preview`. Defaults to a recent date that the installed Miniflare supports. */
  compatibilityDate?: string;
  /** Compatibility flags of the Worker in `astro preview`, for example `["nodejs_compat"]`. */
  compatibilityFlags?: string[];
  /** Where to keep KV, D1 and R2 data between runs: a directory, or `true` for Miniflare's default. By default data lives in memory. */
  persist?: boolean | string;
}

export interface PlatformProxyOptions {
  /** Path to the tool's config file, relative to the project root. */
  configPath?: string;
  /** Named environment in the config file to use. */
  environment?: string;
  /** Where to persist local binding data, or `false` to keep it in memory. */
  persist?: boolean | { path: string };
  /** Bindings for `tool: "miniflare"`. */
  miniflare?: MiniflareBindingOptions;
}

export interface PlatformProxyProvider {
  readonly name: string;
  start(options: PlatformProxyOptions): Promise<PlatformProxy>;
}
