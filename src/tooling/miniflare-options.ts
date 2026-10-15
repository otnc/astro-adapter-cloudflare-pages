import type { MiniflareBindingOptions } from "./platform-proxy.js";

/** The binding options of a Miniflare instance, left out when not set. Shared by `astro dev` and `astro preview`. */
export function toMiniflareBindings(options: MiniflareBindingOptions) {
  const { bindings, kvNamespaces, d1Databases, r2Buckets, persist } = options;
  return {
    ...(bindings && { bindings }),
    ...(kvNamespaces && { kvNamespaces }),
    ...(d1Databases && { d1Databases }),
    ...(r2Buckets && { r2Buckets }),
    ...(persist !== undefined && {
      kvPersist: persist,
      d1Persist: persist,
      r2Persist: persist,
    }),
  };
}

/** Whether any variable, KV namespace, D1 database or R2 bucket is declared. */
export function hasBindings(options: MiniflareBindingOptions): boolean {
  return Boolean(
    options.bindings ??
    options.kvNamespaces ??
    options.d1Databases ??
    options.r2Buckets
  );
}
