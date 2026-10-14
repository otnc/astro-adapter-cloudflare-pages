import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

// The default imageService ("compile"): sharp for prerendered pages, no-op in the Worker.
export default defineConfig({
  output: "server",
  adapter: cloudflarePages(),
});
