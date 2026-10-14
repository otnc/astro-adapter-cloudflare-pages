import { defineConfig, envField } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

export default defineConfig({
  output: "server",
  adapter: cloudflarePages(),
  env: {
    schema: {
      GREETING: envField.string({ context: "server", access: "secret" }),
    },
  },
  redirects: {
    "/old": "/",
    "/blog/[slug]": "/hello/[slug]",
  },
});
