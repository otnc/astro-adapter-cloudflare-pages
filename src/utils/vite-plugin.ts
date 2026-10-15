import type { AstroConfig } from "astro";

/**
 * A Vite plugin as Astro's config accepts it. It is derived from Astro's types, because `vite` is not a dependency of this package and strict package managers would not resolve a direct import for users.
 */
export type VitePlugin = NonNullable<
  NonNullable<AstroConfig["vite"]>["plugins"]
>[number];
