import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
// Miniflare 5 renamed its options; the adapter converts the Miniflare 4 ones.
const MINIFLARE_5 = "5.20261012.0-beta";

describe.each(astroMajors())(
  "Astro %i: Miniflare 5 (preview and toml-config fixtures)",
  (major) => {
    let preview: PagesServer;
    let tomlDir: string;

    beforeAll(async () => {
      const previewDir = prepareProject(
        major,
        "preview",
        tarball,
        { miniflare: MINIFLARE_5 },
        "mf5"
      );
      buildProject(previewDir);
      preview = await startAstroPreview(previewDir, 8920 + major);
      tomlDir = prepareProject(
        major,
        "toml-config",
        tarball,
        { miniflare: MINIFLARE_5 },
        "mf5"
      );
      buildProject(tomlDir);
    });

    afterAll(() => {
      preview?.stop();
    });

    it("runs astro preview with bindings, redirects and the client address", async () => {
      const html = await (await fetch(`${preview.url}/ssr`)).text();
      expect(textOf(html, "greeting")).toBe("hello from preview");
      expect(html).toMatch(/<p id="client">[\d.:a-f]+<\/p>/);
      const redirect = await fetch(`${preview.url}/old`, {
        redirect: "manual",
      });
      expect(redirect.status).toBe(301);
    });

    it("starts astro dev with tool miniflare and the bindings of wrangler.toml", async () => {
      const dev = await startAstroDev(tomlDir, 8930 + major);
      try {
        const html = await (await fetch(`${dev.url}/ssr`)).text();
        expect(textOf(html, "greeting")).toBe("hello from wrangler.toml");
        expect(textOf(html, "kv")).toBe("stored");
      } finally {
        dev.stop();
      }
    });
  }
);
