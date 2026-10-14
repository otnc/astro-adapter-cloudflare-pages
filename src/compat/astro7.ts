import { sessionDrivers } from "astro/config";
import type { AstroCompat } from "./types.js";

export const astro7: AstroCompat = {
  major: 7,
  createKVSessionConfig(bindingName, userSession) {
    return {
      ...userSession,
      driver: sessionDrivers.cloudflareKVBinding({ binding: bindingName }),
    };
  },
  // Astro 7 builds with Vite 8 and rolldown, which configure output under rolldownOptions.
  bundleServerAsOneModule(vite) {
    const ssr = ((vite.environments ??= {}).ssr ??= {});
    const build = (ssr.build ??= {});
    const options = (build.rolldownOptions ??= {});
    options.output = {
      ...vite.build?.rolldownOptions?.output,
      ...options.output,
      codeSplitting: false,
    };
  },
};
