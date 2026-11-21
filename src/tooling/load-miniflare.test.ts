import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadMiniflare } from "./load-miniflare.js";

let projects: string[] = [];

afterEach(() => {
  for (const dir of projects) rmSync(dir, { recursive: true, force: true });
  projects = [];
});

function writePackage(
  dir: string,
  name: string,
  main: string,
  source = FAKE_MINIFLARE
) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, main }));
  writeFileSync(join(dir, main), main.endsWith(".js") ? source : "");
}

// Keeps the options it receives and where it was loaded from, so a test can tell which copy ran.
const FAKE_MINIFLARE = `
const origin = __dirname;
class Miniflare { constructor(options) { this.options = options; this.origin = origin; } }
module.exports = { Miniflare, Response: globalThis.Response };
`;

const FAKE_MINIFLARE_5 = `${FAKE_MINIFLARE}
module.exports.convertV4MiniflareOptions = (options) => ({ workers: [options] });
`;

type FakeInstance = { origin: string; options: unknown };

function createProject(
  layout: "direct" | "through-wrangler" | "both" | "miniflare-5"
) {
  const root = mkdtempSync(join(tmpdir(), "load-miniflare-"));
  projects.push(root);
  writeFileSync(join(root, "package.json"), "{}");
  const modules = join(root, "node_modules");
  if (layout === "miniflare-5") {
    writePackage(
      join(modules, "miniflare"),
      "miniflare",
      "index.js",
      FAKE_MINIFLARE_5
    );
    return pathToFileURL(root + "/");
  }
  if (layout !== "through-wrangler") {
    writePackage(join(modules, "miniflare"), "miniflare", "index.js");
  }
  if (layout !== "direct") {
    writePackage(join(modules, "wrangler"), "wrangler", "cli.cjs");
    writePackage(
      join(modules, "wrangler", "node_modules", "miniflare"),
      "miniflare",
      "index.js"
    );
  }
  return pathToFileURL(root + "/");
}

describe("loadMiniflare", () => {
  it("loads the Miniflare installed in the project", async () => {
    const root = createProject("direct");
    const { create } = await loadMiniflare(root);
    const instance = create({ script: "" }) as unknown as FakeInstance;
    expect(instance.origin).toBe(
      join(fileURLToPath(root), "node_modules", "miniflare")
    );
  });

  it("falls back to the Miniflare that Wrangler depends on", async () => {
    const root = createProject("through-wrangler");
    const { create } = await loadMiniflare(root);
    const instance = create({ script: "" }) as unknown as FakeInstance;
    expect(instance.origin).toBe(
      join(
        fileURLToPath(root),
        "node_modules",
        "wrangler",
        "node_modules",
        "miniflare"
      )
    );
  });

  it("prefers the project's Miniflare over the one Wrangler depends on", async () => {
    const root = createProject("both");
    const { create } = await loadMiniflare(root);
    const instance = create({ script: "" }) as unknown as FakeInstance;
    expect(instance.origin).toBe(
      join(fileURLToPath(root), "node_modules", "miniflare")
    );
  });

  it("converts the Miniflare 4 options when Miniflare 5 exports the converter", async () => {
    const root = createProject("miniflare-5");
    const { create } = await loadMiniflare(root);
    const instance = create({ script: "x" }) as unknown as FakeInstance;
    expect(instance.options).toEqual({ workers: [{ script: "x" }] });
  });
});
