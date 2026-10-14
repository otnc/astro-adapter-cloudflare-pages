import { astro7 } from "./astro7.js";
import type { AstroCompat } from "./types.js";

type RollupOutput = Record<string, unknown>;
type RollupBuild = { rollupOptions?: { output?: RollupOutput } };

export const astro6: AstroCompat = {
  ...astro7,
  major: 6,
  // Astro 6 builds with Vite 7 and Rollup, which configure output under rollupOptions. The Vite 8 types this package compiles against do not declare them.
  bundleServerAsOneModule(vite) {
    const ssr = ((vite.environments ??= {}).ssr ??= {});
    const build = (ssr.build ??= {}) as RollupBuild;
    const options = (build.rollupOptions ??= {});
    options.output = {
      ...(vite.build as RollupBuild | undefined)?.rollupOptions?.output,
      ...options.output,
      inlineDynamicImports: true,
    };
  },
};
