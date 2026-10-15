import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startAstroPreview,
  startPagesDev,
  textOf,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())(
  "Astro %i: wasm, bin and txt imports (modules fixture)",
  (major) => {
    let dir: string;
    let server: PagesServer;

    beforeAll(async () => {
      dir = prepareProject(major, "modules", tarball, {
        wrangler: "^4",
        miniflare: "^4",
      });
      buildProject(dir);
      server = await startPagesDev(dir, 8850 + major);
    });

    afterAll(() => {
      server?.stop();
    });

    it("emits the wasm file next to the Worker bundle and imports it from there", () => {
      const worker = join(dir, "dist", "_worker.js");
      const files = readdirSync(worker, { recursive: true }).map(String);
      const wasm = files.find((file) => /^add\.[0-9a-f]{8}\.wasm$/.test(file));
      expect(wasm, "wasm file in _worker.js").toBeDefined();
      expect(existsSync(join(worker, wasm!))).toBe(true);
      const importers = files
        .filter((file) => /\.m?js$/.test(file))
        .filter((file) =>
          readFileSync(join(worker, file), "utf-8").includes(wasm!)
        );
      expect(importers.length).toBeGreaterThan(0);
      for (const importer of importers) {
        expect(readFileSync(join(worker, importer), "utf-8")).not.toContain(
          "__ASTRO_ADAPTER_CLOUDFLARE_PAGES_MODULE__"
        );
      }
    });

    it("runs WebAssembly, binary and text imports in on-demand pages", async () => {
      const html = await (await fetch(`${server.url}/wasm`)).text();
      expect(textOf(html, "sum")).toBe("5");
      expect(textOf(html, "blob")).toBe("1,2,3,250");
      expect(textOf(html, "note")).toBe("hello from a text file");
    });

    it("runs the emitted wasm file in astro preview (Miniflare)", async () => {
      const preview = await startAstroPreview(dir, 8860 + major);
      try {
        const html = await (await fetch(`${preview.url}/wasm`)).text();
        expect(textOf(html, "sum")).toBe("5");
        expect(textOf(html, "blob")).toBe("1,2,3,250");
        expect(textOf(html, "note")).toBe("hello from a text file");
      } finally {
        preview.stop();
      }
    });

    it("runs the same imports while prerendering in Node.js", async () => {
      const html = await (await fetch(`${server.url}/`)).text();
      expect(textOf(html, "prerendered-sum")).toBe("42");
      expect(textOf(html, "prerendered-note")).toBe("hello from a text file");
    });
  }
);
