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

export interface PlatformProxyOptions {
  /** Path to the tool's config file, relative to the project root. */
  configPath?: string;
  /** Named environment in the config file to use. */
  environment?: string;
  /** Where to persist local binding data, or `false` to keep it in memory. */
  persist?: boolean | { path: string };
}

export interface PlatformProxyProvider {
  readonly name: string;
  start(options: PlatformProxyOptions): Promise<PlatformProxy>;
}
