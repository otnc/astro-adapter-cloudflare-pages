import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startAstroPreview,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();
const GREETING = "hello from preview";

describe.each(astroMajors())(
  "Astro %i: astro preview serves the build in Miniflare (preview fixture)",
  (major) => {
    let server: PagesServer;

    beforeAll(async () => {
      // Only Miniflare is installed, so the preview needs no Wrangler.
      const dir = prepareProject(major, "preview", tarball, {
        miniflare: "^4",
      });
      buildProject(dir);
      server = await startAstroPreview(dir, 4500 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    const get = (path: string, init?: RequestInit) =>
      fetch(`${server.url}${path}`, { redirect: "manual", ...init });

    it("serves prerendered pages, public files and the prerendered 404", async () => {
      const home = await get("/");
      expect(await home.text()).toContain("Prerendered preview home");
      // public/_headers applies to static files, as on Pages.
      expect(home.headers.get("x-from-headers")).toBe("yes");
      expect((await get("/robots.txt")).status).toBe(200);
      const missing = await get("/missing");
      expect(missing.status).toBe(404);
      expect(await missing.text()).toContain("Preview not found");
    });

    it("renders on-demand pages with the configured bindings and the client address", async () => {
      const response = await get("/ssr");
      const html = await response.text();
      expect(html).toContain(`<p id="greeting">${GREETING}</p>`);
      expect(html).toMatch(/<p id="client">[\d.:a-f]+<\/p>/);
      expect(response.headers.get("set-cookie")).toContain("visited=yes");
    });

    it("applies static redirects like Pages", async () => {
      const response = await get("/old");
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe("/");
    });

    it("forwards request bodies and keeps sessions in KV", async () => {
      // Astro rejects cross-site form posts, so the request carries a same-origin Origin header, as a browser would send.
      const echo = await get("/echo", {
        method: "POST",
        body: "ping",
        headers: { origin: server.url },
      });
      expect(await echo.json()).toEqual({ received: "ping" });

      const first = await get("/session");
      const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
      expect(await first.text()).toContain('<p id="count">1</p>');
      const second = await get("/session", { headers: { cookie } });
      expect(await second.text()).toContain('<p id="count">2</p>');
    });
  }
);
