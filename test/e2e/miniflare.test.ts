import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  packAdapter,
  prepareProject,
  startAstroDev,
  textOf,
  warmUp,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();
const GREETING = "hello from miniflare";

describe.each(astroMajors())(
  'Astro %i: tool "miniflare" without Wrangler (miniflare fixture)',
  (major) => {
    let server: PagesServer;

    beforeAll(async () => {
      // Only Miniflare is installed, to prove that Wrangler is not needed.
      const dir = prepareProject(major, "miniflare", tarball, {
        miniflare: "^4",
      });
      server = await startAstroDev(dir, 4400 + major);
      await warmUp(server, ["/ssr", "/env", "/session"]);
    });

    afterAll(() => {
      server?.stop();
    });

    const get = (path: string, init?: RequestInit) =>
      fetch(`${server.url}${path}`, { redirect: "manual", ...init });

    it("exposes variables, KV and the cf object", async () => {
      const html = await (await get("/ssr")).text();
      expect(textOf(html, "greeting")).toBe(GREETING);
      expect(textOf(html, "kv")).toBe("stored");
      expect(textOf(html, "cf")).toBe("object");
      expect(textOf(html, "has-cf-context")).toBe("true");
    });

    it("resolves astro:env secrets from the bindings", async () => {
      expect(textOf(await (await get("/env")).text(), "secret")).toBe(GREETING);
    });

    it("stores sessions in the Miniflare KV namespace", async () => {
      const first = await get("/session");
      const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
      expect(textOf(await first.text(), "count")).toBe("1");
      const second = await get("/session", { headers: { cookie } });
      expect(textOf(await second.text(), "count")).toBe("2");
    });
  }
);
