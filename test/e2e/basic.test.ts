import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GREETING,
  astroMajors,
  buildProject,
  packAdapter,
  prepareProject,
  startPagesDev,
  type PagesServer,
} from "./harness.js";

const tarball = packAdapter();

describe.each(astroMajors())("Astro %i: basic fixture on Pages", (major) => {
  let dir: string;
  let server: PagesServer;

  beforeAll(async () => {
    dir = prepareProject(major, "basic", tarball);
    buildProject(dir);
    server = await startPagesDev(dir, 8800 + major);
  });

  afterAll(() => {
    server?.stop();
  });

  const get = (path: string, init?: RequestInit) =>
    fetch(`${server.url}${path}`, { redirect: "manual", ...init });

  it("emits the Pages advanced mode layout", () => {
    const dist = join(dir, "dist");
    for (const file of [
      "_worker.js/index.js",
      "_routes.json",
      "_redirects",
      "index.html",
      "404.html",
    ]) {
      expect(existsSync(join(dist, file)), file).toBe(true);
    }
    const routes = JSON.parse(
      readFileSync(join(dist, "_routes.json"), "utf-8")
    );
    expect(routes.include).toEqual(
      expect.arrayContaining(["/ssr", "/hello/*", "/blog/*"])
    );
    expect(routes.exclude).toEqual(
      expect.arrayContaining(["/", "/_astro/*", "/robots.txt", "/old"])
    );
    expect(readFileSync(join(dist, "_redirects"), "utf-8")).toMatch(
      /^\/old\s+\/\s+301$/m
    );
  });

  it("serves prerendered pages and public files", async () => {
    expect(await (await get("/")).text()).toContain("Prerendered home");
    expect((await get("/robots.txt")).status).toBe(200);
  });

  it("renders on-demand pages with bindings, cookies and the client address", async () => {
    const response = await get("/ssr");
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain(`<p id="greeting">${GREETING}</p>`);
    expect(html).toContain('<p id="has-cf-context">true</p>');
    expect(html).toMatch(/<p id="client">[\d.:a-f]+<\/p>/);
    expect(response.headers.get("set-cookie")).toContain("visited=yes");
  });

  it("matches dynamic routes and endpoints", async () => {
    expect(await (await get("/hello/claude")).text()).toContain("Hello claude");
    const api = await get("/api/time");
    expect(api.headers.get("content-type")).toContain("application/json");
    expect(await api.json()).toMatchObject({ ok: true });
  });

  it("reads astro:env secrets from bindings", async () => {
    expect(await (await get("/env")).text()).toContain(
      `<p id="secret">${GREETING}</p>`
    );
  });

  it("serves the prerendered 404 page", async () => {
    const response = await get("/missing");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Custom not found");
  });

  it("handles static and dynamic redirects", async () => {
    const staticRedirect = await get("/old");
    expect(staticRedirect.status).toBe(301);
    expect(
      new URL(staticRedirect.headers.get("location")!, server.url).pathname
    ).toBe("/");

    const dynamicRedirect = await get("/blog/x");
    expect(dynamicRedirect.status).toBe(301);
    expect(
      new URL(dynamicRedirect.headers.get("location")!, server.url).pathname
    ).toBe("/hello/x");
  });

  it("stores sessions in the SESSION KV binding", async () => {
    const first = await get("/session");
    const cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
    expect(await first.text()).toContain('<p id="count">1</p>');
    const second = await get("/session", { headers: { cookie } });
    expect(await second.text()).toContain('<p id="count">2</p>');
  });

  it("runs middleware on on-demand pages", async () => {
    const response = await get("/middleware");
    expect(response.headers.get("x-middleware")).toBe("yes");
    expect(await response.text()).toContain(
      '<p id="from-middleware">set by middleware</p>'
    );
  });

  it("runs actions with access to bindings", async () => {
    expect(await (await get("/action")).text()).toContain(
      `<p id="action">Hello action ${GREETING}</p>`
    );
    const response = await get("/_actions/greet", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ name: "rpc" }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Hello rpc");
  });

  it("renders server islands with bindings", async () => {
    const page = await (await get("/island")).text();
    expect(page).toContain('id="fallback"');
    const islandUrl = /\/_server-islands\/[^'"`\s]+/.exec(page)?.[0];
    expect(islandUrl, "server island URL in the page").toBeDefined();
    const island = await get(islandUrl!.replace(/&amp;/g, "&"));
    expect(island.status).toBe(200);
    expect(await island.text()).toContain(`island ${GREETING}`);
  });
});
