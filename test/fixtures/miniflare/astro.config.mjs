import { defineConfig, envField } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

// No Wrangler in this project: Miniflare provides the bindings in `astro dev`.
export default defineConfig({
  output: "server",
  adapter: cloudflarePages({
    tool: "miniflare",
    platformProxy: {
      miniflare: {
        bindings: { GREETING: "hello from miniflare" },
        kvNamespaces: ["SESSION"],
      },
    },
  }),
  env: {
    schema: {
      GREETING: envField.string({ context: "server", access: "secret" }),
    },
  },
});
