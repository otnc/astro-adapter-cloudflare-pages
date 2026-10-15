import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

export default defineConfig({
  output: "server",
  adapter: cloudflarePages(),
  // The policy of static pages is delivered through _headers.
  security: { csp: true },
});
