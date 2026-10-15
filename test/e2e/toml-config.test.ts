import { beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startAstroDev,
  startAstroPreview,
  textOf,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())(
  "Astro %i: bindings from wrangler.toml (toml-config fixture)",
  (major) => {
    let dir: string;

    beforeAll(() => {
      dir = prepareProject(major, "toml-config", tarball, { miniflare: "^4" });
      buildProject(dir);
    });

    const check = async (server: PagesServer) => {
      try {
        const html = await (await fetch(`${server.url}/ssr`)).text();
        expect(textOf(html, "greeting")).toBe("hello from wrangler.toml");
        expect(textOf(html, "kv")).toBe("stored");
      } finally {
        server.stop();
      }
    };

    it("gives astro preview the variables and KV namespaces of the config", async () => {
      await check(await startAstroPreview(dir, 8870 + major));
    });

    it("gives astro dev (tool miniflare) the same bindings", async () => {
      await check(await startAstroDev(dir, 8880 + major));
    });
  }
);
