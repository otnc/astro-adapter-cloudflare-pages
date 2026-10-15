import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

// No `platformProxy.miniflare`: the bindings come from wrangler.toml.
export default defineConfig({
  output: "server",
  adapter: cloudflarePages({ tool: "miniflare" }),
});
