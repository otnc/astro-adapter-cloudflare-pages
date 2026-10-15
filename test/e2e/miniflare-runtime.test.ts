import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { Miniflare, Response } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GREETING,
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
} from "./harness.js";

const tarball = packAdapter();

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
};

/**
 * A minimal stand-in for Pages' static asset binding: `/` and `/about` map to `index.html` and `about.html`, and unknown paths answer 404. Pages adds more (redirect rules, headers), which the adapter does not rely on.
 */
function createAssets(dist: string) {
  return (request: Request) => {
    const { pathname } = new URL(request.url);
    const candidates =
      pathname === "/"
        ? ["index.html"]
        : [pathname, `${pathname}.html`, `${pathname}/index.html`].map((path) =>
            path.replace(/^\/+/, "")
          );
    for (const candidate of candidates) {
      const file = join(dist, candidate);
      if (!candidate.startsWith("_worker.js") && existsSync(file)) {
        try {
          return new Response(readFileSync(file), {
            headers: {
              "content-type":
                CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
            },
          });
        } catch {
          // A directory: try the next candidate.
        }
      }
    }
    return new Response("Not found", { status: 404 });
  };
}

/** Lists every module of the Worker. Miniflare cannot follow the dynamic import specifiers in the bundle, so each file is declared. */
function listModules(workerDir: string) {
  const files = readdirSync(workerDir, {
    recursive: true,
    withFileTypes: true,
  });
  return (
    files
      .filter((file) => file.isFile() && /\.m?js$/.test(file.name))
      // Absolute paths, so Miniflare reads them from disk; modulesRoot turns them into module names such as chunks/Island.mjs.
      .map((file) => ({
        type: "ESModule" as const,
        path: join(file.parentPath, file.name),
      }))
  );
}

// The build output is plain files, so it also runs in any workerd host. Miniflare, the runtime Wrangler and Pages use, is the one to check.
describe.each(astroMajors())(
  "Astro %i: the build output runs in Miniflare without Wrangler",
  (major) => {
    let mf: Miniflare;

    beforeAll(async () => {
      const dir = prepareProject(major, "basic", tarball);
      buildProject(dir);
      const dist = join(dir, "dist");
      mf = new Miniflare({
        modules: listModules(join(dist, "_worker.js")),
        modulesRoot: join(dist, "_worker.js"),
        compatibilityDate: "2026-08-01",
        bindings: { GREETING },
        kvNamespaces: ["SESSION"],
        serviceBindings: { ASSETS: createAssets(dist) },
      });
      await mf.ready;
    });

    afterAll(async () => {
      await mf?.dispose();
    });

    // Cloudflare sets cf-connecting-ip on every request, and Astro.clientAddress is read from it. A host without Cloudflare's edge has to set it, as a proxy in front of Miniflare would.
    const get = (path: string, init?: RequestInit) =>
      mf.dispatchFetch(`http://localhost${path}`, {
        redirect: "manual",
        ...(init as object),
        headers: {
          "cf-connecting-ip": "203.0.113.7",
          ...(init?.headers as Record<string, string> | undefined),
        },
      });

    it("serves prerendered pages and public files from the assets binding", async () => {
      expect(await (await get("/")).text()).toContain("Prerendered home");
      expect((await get("/robots.txt")).status).toBe(200);
    });

    it("renders on-demand pages with variables, cookies and the Pages runtime", async () => {
      const response = await get("/ssr");
      const html = await response.text();
      expect(html).toContain(`<p id="greeting">${GREETING}</p>`);
      expect(html).toContain('<p id="has-cf-context">true</p>');
      expect(html).toContain('<p id="client">203.0.113.7</p>');
      expect(response.headers.get("set-cookie")).toContain("visited=yes");
    });

    it("runs middleware, actions, server islands and astro:env", async () => {
      expect((await get("/middleware")).headers.get("x-middleware")).toBe(
        "yes"
      );
      expect(await (await get("/action")).text()).toContain(
        `Hello action ${GREETING}`
      );
      const page = await (await get("/island")).text();
      const islandUrl = /\/_server-islands\/[^'"`\s]+/.exec(page)?.[0];
      expect(islandUrl).toBeDefined();
      expect(
        await (await get(islandUrl!.replace(/&amp;/g, "&"))).text()
      ).toContain(`island ${GREETING}`);
      expect(await (await get("/env")).text()).toContain(
        `<p id="secret">${GREETING}</p>`
      );
    });

    it("stores sessions in the KV namespace and renders the 404 page", async () => {
      const first = await get("/session");
      const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
      expect(await first.text()).toContain('<p id="count">1</p>');
      expect(
        await (await get("/session", { headers: { cookie } })).text()
      ).toContain('<p id="count">2</p>');

      const missing = await get("/missing");
      expect(missing.status).toBe(404);
      expect(await missing.text()).toContain("Custom not found");
    });
  }
);
