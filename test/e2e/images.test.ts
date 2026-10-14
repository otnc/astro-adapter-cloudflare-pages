import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startPagesDev,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())(
  'Astro %i: imageService "compile" (images fixture)',
  (major) => {
    let dir: string;
    let server: PagesServer;

    beforeAll(async () => {
      dir = prepareProject(major, "images", tarball);
      buildProject(dir);
      server = await startPagesDev(dir, 8830 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    it("optimizes images of prerendered pages with sharp at build time", () => {
      const assets = readdirSync(join(dir, "dist", "_astro"));
      expect(assets.some((file) => /^photo\..+\.webp$/.test(file))).toBe(true);
      expect(readFileSync(join(dir, "dist", "index.html"), "utf-8")).toMatch(
        /<img[^>]+src="\/_astro\/photo\.[^"]+\.webp"/
      );
    });

    it("keeps sharp and Node.js built-ins out of the Worker", () => {
      const worker = readFileSync(
        join(dir, "dist", "_worker.js", "index.js"),
        "utf-8"
      );
      expect(worker).not.toMatch(/from\s*["']node:/);
      expect(worker).not.toContain("sharp/lib");
    });

    it("serves images of on-demand pages unchanged", async () => {
      const html = await (await fetch(`${server.url}/ssr`)).text();
      const src = /<img[^>]+src="([^"]+)"/.exec(html)?.[1];
      expect(src).toMatch(/^\/_image\?/);
      const image = await fetch(`${server.url}${src!.replace(/&amp;/g, "&")}`);
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toContain("image/");
    });
  }
);

describe.each(astroMajors())(
  'Astro %i: imageService "cloudflare" (images-cloudflare fixture)',
  (major) => {
    let dir: string;

    beforeAll(() => {
      dir = prepareProject(major, "images-cloudflare", tarball);
      buildProject(dir);
    });

    it("points images at Cloudflare Images transformations", () => {
      expect(readFileSync(join(dir, "dist", "index.html"), "utf-8")).toMatch(
        /<img[^>]+src="\/cdn-cgi\/image\/onerror=redirect,width=32[^"]*\/_astro\/photo\.[^"]+\.png"/
      );
    });
  }
);
