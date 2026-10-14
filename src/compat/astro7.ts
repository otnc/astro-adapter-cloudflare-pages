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
};
