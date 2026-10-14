import { astro7 } from "./astro7.js";
import type { AstroCompat } from "./types.js";

export const astro6: AstroCompat = {
  ...astro7,
  major: 6,
};
