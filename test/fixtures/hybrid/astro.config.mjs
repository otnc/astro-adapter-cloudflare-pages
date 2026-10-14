import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

// Static output with a few on-demand pages, plus i18n routing.
export default defineConfig({
  adapter: cloudflarePages(),
  i18n: {
    locales: ["en", "ja"],
    defaultLocale: "en",
  },
});
