import type { AstroConfig, HookParameters } from "astro";

type SessionConfig = Exclude<AstroConfig["session"], false>;

/** Behavior that differs between Astro majors. Keep it small: everything else lives in the shared hooks. */
export interface AstroCompat {
  readonly major: number;
  /** Session config that stores sessions in the given KV binding, keeping the user's cookie and TTL settings. */
  createKVSessionConfig(
    bindingName: string,
    userSession: SessionConfig | undefined
  ): SessionConfig;
  /**
   * Makes the server build emit one module. Pages re-bundles `_worker.js/` and cannot resolve a split chunk that imports back from `../index.js`, which Astro 6 emits for server islands.
   *
   * Called from `astro:build:setup` with the final build config, so the server environment can copy Astro's own output options (such as the `index.js` entry name) instead of replacing them.
   */
  bundleServerAsOneModule(
    vite: HookParameters<"astro:build:setup">["vite"]
  ): void;
}
