import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GREETING,
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startPagesDev,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())(
  "Astro %i: static output with on-demand pages and i18n (hybrid fixture)",
  (major) => {
    let dir: string;
    let server: PagesServer;

    beforeAll(async () => {
      dir = prepareProject(major, "hybrid", tarball);
      buildProject(dir);
      server = await startPagesDev(dir, 8810 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    const get = (path: string) =>
      fetch(`${server.url}${path}`, { redirect: "manual" });

    it("routes only the on-demand pages to the Worker", () => {
      const routes = JSON.parse(
        readFileSync(join(dir, "dist", "_routes.json"), "utf-8")
      );
      expect(routes.include).toEqual(
        expect.arrayContaining(["/dynamic", "/ja/dynamic"])
      );
      expect(routes.include).not.toContain("/*");
    });

    it("serves prerendered pages", async () => {
      expect(await (await get("/")).text()).toContain("Static home");
      expect(await (await get("/ja/")).text()).toContain("Static ja home");
    });

    it("renders on-demand pages with bindings and the current locale", async () => {
      const html = await (await get("/dynamic")).text();
      expect(html).toContain(`<p id="greeting">${GREETING}</p>`);
      expect(html).toContain('<p id="locale">en</p>');
      expect(await (await get("/ja/dynamic")).text()).toContain(
        '<p id="locale">ja</p>'
      );
    });
  }
);

// Astro 6 has Advanced Routing only as an experimental feature (experimental.advancedRouting with src/app.ts); it is stable from Astro 7.
describe.each(astroMajors().filter((major) => major >= 7))(
  "Astro %i: Advanced Routing with src/fetch.ts (advanced fixture)",
  (major) => {
    let server: PagesServer;

    beforeAll(async () => {
      const dir = prepareProject(major, "advanced", tarball);
      buildProject(dir);
      server = await startPagesDev(dir, 8820 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    const get = (path: string) => fetch(`${server.url}${path}`);

    it("lets the custom fetch handler answer its own paths", async () => {
      const response = await get("/custom");
      expect(response.headers.get("x-custom-fetch")).toBe("yes");
      expect(await response.text()).toBe("handled by src/fetch.ts");
    });

    it("hands other requests to Astro with the Pages runtime", async () => {
      expect(await (await get("/ssr")).text()).toContain(
        `<p id="greeting">${GREETING}</p>`
      );
      expect(await (await get("/")).text()).toContain("Advanced home");
      expect((await get("/robots.txt")).status).toBe(200);
    });

    it("renders Astro's 404 for unknown paths instead of the home page", async () => {
      const response = await get("/missing");
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("Advanced home");
    });
  }
);
