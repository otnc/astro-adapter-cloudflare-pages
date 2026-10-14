import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/entrypoints/server.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  // Node >= 22 supports ES2024
  target: "node22",
  platform: "node",
  external: [/^cloudflare:/, /^astro(\/|$)/, /^virtual:/],
});
