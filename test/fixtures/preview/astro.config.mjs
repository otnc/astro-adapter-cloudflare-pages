import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

// `astro preview` runs the build in Miniflare, with the bindings declared here.
export default defineConfig({
  output: "server",
  adapter: cloudflarePages({
    tool: "miniflare",
    platformProxy: {
      miniflare: {
        bindings: { GREETING: "hello from preview" },
        kvNamespaces: ["SESSION"],
      },
    },
  }),
  redirects: { "/old": "/" },
});
