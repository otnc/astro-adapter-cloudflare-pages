import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  packAdapter,
  prepareProject,
  startAstroDev,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();
// Values come from test/fixtures/basic/wrangler.jsonc through Wrangler's platform proxy.
const VARS_GREETING = "hello from vars";

// `astro dev` adds attributes such as data-astro-source-file, so match the element by id only.
function textOf(html: string, id: string): string | undefined {
  return new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html)?.[1];
}

describe.each(astroMajors())(
  "Astro %i: basic fixture in astro dev",
  (major) => {
    let server: PagesServer;

    beforeAll(async () => {
      const dir = prepareProject(major, "basic", tarball);
      server = await startAstroDev(dir, 4300 + major);
      // The first request to a page can make Vite optimize new dependencies and reload, dropping connections. Visit each page until it answers twice in a row.
      for (const path of ["/ssr", "/env", "/session"]) {
        let streak = 0;
        for (let attempt = 0; attempt < 20 && streak < 2; attempt++) {
          const ok = await fetch(`${server.url}${path}`, {
            signal: AbortSignal.timeout(10_000),
          }).then(
            (response) => response.ok,
            () => false
          );
          streak = ok ? streak + 1 : 0;
          if (!ok) await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
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
