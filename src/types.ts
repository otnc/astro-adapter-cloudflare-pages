import type {
  CacheStorage,
  ExecutionContext,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";

/**
 * The Cloudflare Pages runtime that this adapter exposes as `Astro.locals.runtime`, with the same shape as `@astrojs/cloudflare` v12.
 *
 * Declare your bindings by passing their type, then augment `App.Locals` in `src/env.d.ts`:
 *
 * @example
 * ```ts
 * type Runtime = import("astro-adapter-cloudflare-pages").Runtime<Env>;
 *
 * declare namespace App {
 *   interface Locals extends Runtime {}
 * }
 * ```
 */
export interface Runtime<Env = Record<string, unknown>> {
  runtime: {
    env: Env;
    cf: IncomingRequestCfProperties | undefined;
    caches: CacheStorage;
    ctx: PagesExecutionContext;
  };
  /** The raw execution context, under the same name as `@astrojs/cloudflare` v13 and later use. */
  cfContext: ExecutionContext;
}

/**
 * `ExecutionContext` as Pages Functions provide it: `passThroughOnException()` exists but always throws, because Pages does not support it.
 */
export interface PagesExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): never;
  props: Record<string, unknown>;
}
