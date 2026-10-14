import { describe, expect, it } from "vitest";
import {
  PAGES_ROUTE_RULE_LIMIT,
  createRoutesJson,
  getParts,
  type RouteInput,
  type RoutesJsonInput,
} from "./routes-json.js";

function route(
  pattern: string,
  type: string,
  isPrerendered: boolean
): RouteInput {
  const segments = pattern.split("/").filter(Boolean).map(getParts);
  const isStatic = segments.every((parts) =>
    parts.every((part) => !part.dynamic)
  );
  return {
    type,
    isPrerendered,
    pathname: isStatic ? pattern : undefined,
    segments,
  };
}

function input(overrides: Partial<RoutesJsonInput>): RoutesJsonInput {
  return {
    base: "/",
    assetsDir: "_astro",
    publicFiles: [],
    routes: [],
    prerenderedPathnames: [],
    redirectSources: [],
    ...overrides,
  };
}

const notFound = route("/404", "page", true);

describe("getParts", () => {
  it("splits static and dynamic parts of a segment", () => {
    expect(getParts("[slug].json")).toEqual([
      { content: "slug", dynamic: true, spread: false },
      { content: ".json", dynamic: false, spread: false },
    ]);
    expect(getParts("[...rest]")).toEqual([
      { content: "...rest", dynamic: true, spread: true },
    ]);
  });

  it("rejects invalid parameter names", () => {
    expect(() => getParts("[a-b]")).toThrow();
  });
});

describe("createRoutesJson", () => {
  it("lists only on-demand routes when a prerendered 404 exists", () => {
    const result = createRoutesJson(
      input({
        routes: [
          route("/", "page", true),
          route("/ssr", "page", false),
          route("/hello/[name]", "page", false),
          route("/api/time", "endpoint", false),
          notFound,
        ],
        prerenderedPathnames: ["/", "/404"],
      })
    );
    // A wildcard include needs the static paths excluded, and /api/time widens to /api/* because nothing static lives under /api.
    expect(result).toEqual({
      version: 1,
      include: ["/ssr", "/hello/*", "/api/*"],
      exclude: ["/", "/_astro/*", "/404"],
    });
  });

  it("falls back to /* without a prerendered 404, excluding assets and public files", () => {
    const result = createRoutesJson(
      input({
        publicFiles: ["robots.txt", "_headers", "fonts/a.woff2"],
        routes: [route("/ssr", "page", false)],
      })
    );
    expect(result.include).toEqual(["/*"]);
    // Paths under a folder that holds no on-demand route collapse into a wildcard.
    expect(result.exclude).toEqual(["/_astro/*", "/robots.txt", "/fonts/*"]);
  });

  it("prefixes rules with the base path", () => {
    const result = createRoutesJson(
      input({ base: "/docs/", routes: [route("/ssr", "page", false)] })
    );
    expect(result.exclude).toContain("/docs/_astro/*");
  });

  it("excludes static redirects and sends dynamic ones to the Worker", () => {
    const result = createRoutesJson(
      input({
        routes: [
          route("/old", "redirect", false),
          route("/blog/[slug]", "redirect", false),
          route("/ssr", "page", false),
          notFound,
        ],
      })
    );
    expect(result.include).toContain("/blog/*");
    expect(result.include).not.toContain("/old");
  });

  it("excludes sources from an existing _redirects file, turning :params into wildcards", () => {
    const result = createRoutesJson(
      input({
        redirectSources: ["/legacy/:id"],
        routes: [route("/ssr", "page", false)],
      })
    );
    expect(result.exclude).toContain("/legacy/*");
  });

  it("appends extend rules", () => {
    const result = createRoutesJson(
      input({
        routes: [route("/ssr", "page", false), notFound],
        extendInclude: ["/custom/*"],
        extendExclude: ["/static/*"],
      })
    );
    expect(result.include).toEqual(["/ssr", "/custom/*"]);
    expect(result.exclude).toEqual([]);
  });

  it("stays within the Pages rule limit", () => {
    const publicFiles = Array.from(
      { length: 250 },
      (_, index) => `file-${index}.txt`
    );
    const result = createRoutesJson(
      input({ publicFiles, routes: [route("/ssr", "page", false)] })
    );
    expect(result.include.length + result.exclude.length).toBeLessThanOrEqual(
      PAGES_ROUTE_RULE_LIMIT
    );
  });
});
