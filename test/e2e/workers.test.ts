import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startAstroPreview,
  startWranglerDev,
  textOf,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())(
  'Astro %i: target "workers" (workers fixture)',
  (major) => {
    let dir: string;
    let server: PagesServer;

    beforeAll(async () => {
      dir = prepareProject(major, "workers", tarball, {
        wrangler: "^4",
        miniflare: "^4",
      });
      buildProject(dir);
      server = await startWranglerDev(dir, 8900 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    it("writes the Worker to server/ and the static files to client/", () => {
      const dist = join(dir, "dist");
      expect(existsSync(join(dist, "server", "index.js"))).toBe(true);
      expect(existsSync(join(dist, "client", "index.html"))).toBe(true);
      expect(existsSync(join(dist, "_worker.js"))).toBe(false);
      expect(existsSync(join(dist, "_routes.json"))).toBe(false);
      expect(
        readFileSync(join(dist, "client", "_redirects"), "utf-8")
      ).toContain("/old");
    });

    const check = async (url: string) => {
      const home = await fetch(`${url}/`);
      expect(await home.text()).toContain("prerendered home");
      expect(home.headers.get("x-from-headers")).toBe("yes");
      const html = await (await fetch(`${url}/ssr`)).text();
      expect(textOf(html, "greeting")).toBe("hello from workers");
      const redirect = await fetch(`${url}/old`, { redirect: "manual" });
      expect(redirect.status).toBe(301);
    };

    it("runs on wrangler dev with static assets", async () => {
      await check(server.url);
    });

    it("runs in astro preview with the assets from client/", async () => {
      const preview = await startAstroPreview(dir, 8910 + major);
      try {
        await check(preview.url);
      } finally {
        preview.stop();
      }
    });
  }
);
