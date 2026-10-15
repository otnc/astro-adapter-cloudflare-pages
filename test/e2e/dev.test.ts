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
// Values come from test/fixtures/basic/wrangler.jsonc through Wrangler's platform proxy.
const VARS_GREETING = "hello from vars";

describe.each(astroMajors())(
  "Astro %i: basic fixture in astro dev",
  (major) => {
    let server: PagesServer;

    beforeAll(async () => {
      const dir = prepareProject(major, "basic", tarball);
      server = await startAstroDev(dir, 4300 + major);
      await warmUp(server, ["/ssr", "/env", "/session"]);
    });

    afterAll(() => {
      server?.stop();
    });

    const get = (path: string, init?: RequestInit) =>
      fetch(`${server.url}${path}`, { redirect: "manual", ...init });

    it("exposes bindings as Astro.locals.runtime", async () => {
      const html = await (await get("/ssr")).text();
      expect(textOf(html, "greeting")).toBe(VARS_GREETING);
      expect(textOf(html, "has-cf-context")).toBe("true");
    });

    it("resolves astro:env secrets from bindings", async () => {
      const response = await get("/env");
      expect(response.status).toBe(200);
      expect(textOf(await response.text(), "secret")).toBe(VARS_GREETING);
    });

    it("stores sessions in the emulated KV namespace", async () => {
      const first = await get("/session");
      const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
      expect(textOf(await first.text(), "count")).toBe("1");
      const second = await get("/session", { headers: { cookie } });
      expect(textOf(await second.text(), "count")).toBe("2");
    });
  }
);
