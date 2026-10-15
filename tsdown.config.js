import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/entrypoints/server.ts",
    "src/entrypoints/image-service.ts",
    "src/entrypoints/preview.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  // Node >= 22 supports ES2024
  target: "node22",
  platform: "node",
  // Astro and Vite come from the user's project; Vite is a dependency of Astro.
  external: [/^cloudflare:/, /^astro(\/|$)/, /^virtual:/, /^vite$/],
});
