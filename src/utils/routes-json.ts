// Ported from `@astrojs/cloudflare` v12 (`utils/generate-routes-json.js`), MIT License, Copyright (c) 2021 Fred K. Schott.

/** Pages rejects a `_routes.json` with more include and exclude rules than this, combined. */
export const PAGES_ROUTE_RULE_LIMIT = 100;

export interface RoutePart {
  content: string;
  dynamic: boolean;
  spread: boolean;
}

export interface RouteInput {
  type: string;
  isPrerendered: boolean;
  pathname?: string | undefined;
  segments: RoutePart[][];
}

export interface RoutesJsonInput {
  /** Astro `base`, for example `/` or `/docs/`. */
  base: string;
  /** Astro `build.assets`, for example `_astro`. */
  assetsDir: string;
  /** Files in `public/`, relative and with forward slashes. */
  publicFiles: string[];
  routes: RouteInput[];
  /** Pathnames of the pages Astro prerendered, as `astro:build:done` reports them. */
  prerenderedPathnames: string[];
  /** Source paths of rules in an existing `_redirects` file. */
  redirectSources: string[];
  extendInclude?: string[];
  extendExclude?: string[];
}

export interface RoutesJson {
  version: 1;
  include: string[];
  exclude: string[];
}

const ROUTE_DYNAMIC_SPLIT = /\[(.+?\(.+?\)|.+?)\]/;
const ROUTE_SPREAD = /^\.{3}.+$/;
const PAGES_RESERVED_FILES = new Set([
  "_headers",
  "_redirects",
  "_routes.json",
]);

/** Splits one path segment such as `[slug].json` into static and dynamic parts. */
export function getParts(segment: string): RoutePart[] {
  const parts: RoutePart[] = [];
  segment.split(ROUTE_DYNAMIC_SPLIT).forEach((piece, index) => {
    if (!piece) return;
    const dynamic = index % 2 === 1;
    const content = dynamic ? (/([^(]+)$/.exec(piece)?.[1] ?? null) : piece;
    if (!content || (dynamic && !/^(?:\.\.\.)?[\w$]+$/.test(content))) {
      throw new Error("Parameter name must match /^[a-zA-Z0-9_$]+$/");
    }
    parts.push({
      content,
      dynamic,
      spread: dynamic && ROUTE_SPREAD.test(content),
    });
  });
  return parts;
}

function pathToSegments(path: string): RoutePart[][] {
  return path.split("/").filter(Boolean).map(getParts);
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

/** Converts route segments to `_routes.json` path segments, where any dynamic part becomes `*`. */
function toPagesSegments(segments: RoutePart[][], base: string): string[] {
  const result: string[] = [];
  const trimmedBase = trimSlashes(base);
  if (trimmedBase) result.push(trimmedBase);
  for (const part of segments.flat()) {
    result.push(part.dynamic ? "*" : part.content);
  }
  return result;
}

class TrieNode {
  children = new Map<string, TrieNode>();
  isEndOfPath = false;
  hasWildcardChild = false;
}

class PathTrie {
  root = new TrieNode();
  private returnHasWildcard = false;

  insert(path: string[]): void {
    let node = this.root;
    for (const segment of path) {
      if (segment === "*") {
        node.hasWildcardChild = true;
        break;
      }
      let child = node.children.get(segment);
      if (!child) {
        child = new TrieNode();
        node.children.set(segment, child);
      }
      node = child;
    }
    node.isEndOfPath = true;
  }

  // A path under an existing wildcard prefix is dropped: with `/foo/*` present, `/foo/bar` is redundant.
  private collect(node: TrieNode, path: string[], all: string[][]): void {
    if (node.hasWildcardChild) {
      this.returnHasWildcard = true;
      all.push([...path, "*"]);
      return;
    }
    if (node.isEndOfPath) all.push([...path]);
    for (const [segment, child] of node.children) {
      this.collect(child, [...path, segment], all);
    }
  }

  // Collapses a subtree into a wildcard when the other trie has no rule under the same prefix, which keeps the rule count low.
  private reduce(other: TrieNode, node: TrieNode): void {
    if (node.hasWildcardChild || other.hasWildcardChild) return;
    for (const [segment, child] of node.children) {
      if (child.children.size === 0) continue;
      const otherChild = other.children.get(segment);
      if (otherChild === undefined) {
        child.hasWildcardChild = true;
        continue;
      }
      this.reduce(otherChild, child);
    }
  }

  reduceAgainst(other: PathTrie): this {
    this.reduce(other.root, this.root);
    return this;
  }

  getAllPaths(): [paths: string[][], hasWildcard: boolean] {
    const all: string[][] = [];
    this.collect(this.root, [], all);
    return [all, this.returnHasWildcard];
  }
}

function toRule(path: string[]): string {
  return `/${path.join("/")}`;
}

/**
 * Builds the `_routes.json` that tells Pages which requests invoke the Worker, so static assets and prerendered pages are served without it.
 *
 * Without a prerendered 404 page, or when the precise rule set exceeds {@link PAGES_ROUTE_RULE_LIMIT}, it falls back to including `/*` and excluding as many static paths as fit.
 *
 * @example
 * ```ts
 * createRoutesJson({ base: "/", assetsDir: "_astro", publicFiles: [], routes, prerenderedPathnames: [], redirectSources: [] });
 * // { version: 1, include: ["/*"], exclude: ["/_astro/*"] }
 * ```
 */
export function createRoutesJson(input: RoutesJsonInput): RoutesJson {
  const { base } = input;
  const includePaths: string[][] = [];
  const excludePaths: string[][] = [];

  excludePaths.push(
    toPagesSegments(
      [
        [{ content: input.assetsDir, dynamic: false, spread: false }],
        [{ content: "", dynamic: true, spread: false }],
      ],
      base
    )
  );

  for (const source of input.redirectSources) {
    const pattern = trimSlashes(source)
      .replace(/:[^/]+/g, "*")
      .replace(/\?.*$/, "");
    excludePaths.push(toPagesSegments(pathToSegments(pattern), base));
  }

  for (const file of input.publicFiles) {
    if (PAGES_RESERVED_FILES.has(file)) continue;
    excludePaths.push(toPagesSegments(pathToSegments(file), base));
  }

  let hasPrerendered404 = false;
  for (const route of input.routes) {
    const path = toPagesSegments(route.segments, base);
    if (route.pathname === "/404" && route.isPrerendered) {
      hasPrerendered404 = true;
    }
    switch (route.type) {
      case "page":
        if (!route.isPrerendered) includePaths.push(path);
        break;
      case "endpoint":
        if (route.isPrerendered) excludePaths.push(path);
        else includePaths.push(path);
        break;
      case "redirect":
        // Static redirects go to _redirects, which Pages applies only to requests that skip the Worker. Dynamic ones are rendered by the Worker.
        if (route.pathname) excludePaths.push(path);
        else includePaths.push(path);
        break;
      default:
        includePaths.push(path);
        break;
    }
  }

  for (const pathname of input.prerenderedPathnames) {
    if (trimSlashes(pathname) === "404") hasPrerendered404 = true;
    excludePaths.push(toPagesSegments(pathToSegments(pathname), base));
  }

  const includeTrie = new PathTrie();
  for (const path of includePaths) includeTrie.insert(path);
  const excludeTrie = new PathTrie();
  for (const path of excludePaths) {
    if (path[0] === "*") continue;
    excludeTrie.insert(path);
  }

  const [includes, includesHaveWildcard] = includeTrie
    .reduceAgainst(excludeTrie)
    .getAllPaths();
  const [excludes] = excludeTrie.reduceAgainst(includeTrie).getAllPaths();

  const extendInclude = input.extendInclude ?? [];
  const extendExclude = input.extendExclude ?? [];
  const preciseRuleCount =
    includes.length +
    extendInclude.length +
    (includesHaveWildcard ? excludes.length + extendExclude.length : 0);

  if (!hasPrerendered404 || preciseRuleCount > PAGES_ROUTE_RULE_LIMIT) {
    const excludeBudget =
      PAGES_ROUTE_RULE_LIMIT - extendInclude.length - extendExclude.length - 1;
    return {
      version: 1,
      include: ["/*", ...extendInclude],
      exclude: [
        ...excludes.map(toRule).slice(0, Math.max(0, excludeBudget)),
        ...extendExclude,
      ],
    };
  }

  return {
    version: 1,
    include: [...includes.map(toRule), ...extendInclude],
    exclude: includesHaveWildcard
      ? [...excludes.map(toRule), ...extendExclude]
      : [],
  };
}
