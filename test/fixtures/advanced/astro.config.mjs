import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

export default defineConfig({
  output: "server",
  adapter: cloudflarePages(),
});
