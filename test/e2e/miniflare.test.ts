import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  packAdapter,
  prepareProject,
  startAstroDev,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();
const GREETING = "hello from miniflare";

function textOf(html: string, id: string): string | undefined {
  return new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html)?.[1];
}

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
