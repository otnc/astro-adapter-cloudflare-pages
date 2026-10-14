import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/e2e/**/*.test.ts"],
    // Installing Astro, building the fixture and starting Wrangler can take minutes on a cold cache.
    testTimeout: 60_000,
    hookTimeout: 600_000,
    fileParallelism: false,
  },
});
