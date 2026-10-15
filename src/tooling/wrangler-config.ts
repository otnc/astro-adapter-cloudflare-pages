import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { MiniflareBindingOptions } from "./platform-proxy.js";

export const WRANGLER_CONFIG_FILES = [
  "wrangler.jsonc",
  "wrangler.json",
  "wrangler.toml",
];

type Json = Record<string, unknown>;

/** Removes comments and trailing commas, which `wrangler.jsonc` allows and `JSON.parse` does not. */
export function stripJsonc(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inString) {
      out += char;
      if (char === "\\") out += text[++i] ?? "";
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (char === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else {
      out += char;
    }
  }
  return removeTrailingCommas(out);
}

function removeTrailingCommas(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (inString) {
      out += char;
      if (char === "\\") out += text[++i] ?? "";
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === ",") {
      const next = /^\s*([}\]])/.exec(text.slice(i + 1));
      if (!next) out += char;
    } else {
      out += char;
    }
  }
  return out;
}

/** Parses the text of a Wrangler config file by its extension: `.toml`, or JSON with comments. */
export function parseWranglerConfig(text: string, file: string): Json {
  const parsed: unknown =
    extname(file) === ".toml" ? parseToml(text) : JSON.parse(stripJsonc(text));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The config file must contain an object.");
  }
  return parsed as Json;
}

/** The config file of the project: the given path, or the first `wrangler.*` file in the root. */
export function findWranglerConfig(
  root: string,
  configPath?: string
): string | undefined {
  const candidates = configPath ? [configPath] : WRANGLER_CONFIG_FILES;
  return candidates
    .map((file) => resolve(root, file))
    .find((file) => existsSync(file));
}

function asRecord(value: unknown): Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function bindingNames(entries: unknown): string[] | undefined {
  if (!Array.isArray(entries)) return undefined;
  const names = entries
    .map((entry) => asRecord(entry).binding)
    .filter((name): name is string => typeof name === "string");
  return names.length > 0 ? names : undefined;
}

/**
 * The binding options that a Wrangler config declares: variables, KV namespaces, D1 databases, R2 buckets, and the compatibility settings. A named environment replaces the top-level values it sets, as in Wrangler, where these keys are not inherited.
 */
export function bindingsFromWranglerConfig(
  config: Json,
  environment?: string
): MiniflareBindingOptions {
  const env = environment ? asRecord(asRecord(config.env)[environment]) : {};
  const pick = (key: string): unknown => (key in env ? env[key] : config[key]);

  const vars = Object.entries(asRecord(pick("vars"))).filter(
    (entry): entry is [string, string | number | boolean] =>
      ["string", "number", "boolean"].includes(typeof entry[1])
  );
  const flags = pick("compatibility_flags");
  const date = pick("compatibility_date");
  const kvNamespaces = bindingNames(pick("kv_namespaces"));
  const d1Databases = bindingNames(pick("d1_databases"));
  const r2Buckets = bindingNames(pick("r2_buckets"));

  return {
    ...(vars.length > 0 && { bindings: Object.fromEntries(vars) }),
    ...(kvNamespaces && { kvNamespaces }),
    ...(d1Databases && { d1Databases }),
    ...(r2Buckets && { r2Buckets }),
    ...(typeof date === "string" && { compatibilityDate: date }),
    ...(Array.isArray(flags) && {
      compatibilityFlags: flags.filter(
        (flag): flag is string => typeof flag === "string"
      ),
    }),
  };
}

const union = (a?: string[], b?: string[]) =>
  a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined;

/** Combines the bindings from a config file with the `platformProxy.miniflare` option, which wins where both set a value. */
export function mergeBindingOptions(
  fromConfig: MiniflareBindingOptions,
  explicit: MiniflareBindingOptions | undefined
): MiniflareBindingOptions {
  const own = explicit ?? {};
  const bindings = { ...fromConfig.bindings, ...own.bindings };
  const kvNamespaces = union(fromConfig.kvNamespaces, own.kvNamespaces);
  const d1Databases = union(fromConfig.d1Databases, own.d1Databases);
  const r2Buckets = union(fromConfig.r2Buckets, own.r2Buckets);
  const compatibilityDate =
    own.compatibilityDate ?? fromConfig.compatibilityDate;
  const compatibilityFlags =
    own.compatibilityFlags ?? fromConfig.compatibilityFlags;
  return {
    ...(Object.keys(bindings).length > 0 && { bindings }),
    ...(kvNamespaces && { kvNamespaces }),
    ...(d1Databases && { d1Databases }),
    ...(r2Buckets && { r2Buckets }),
    ...(compatibilityDate && { compatibilityDate }),
    ...(compatibilityFlags && { compatibilityFlags }),
    ...(own.persist !== undefined && { persist: own.persist }),
  };
}

/** Reads the config file of the project and returns its bindings merged with the option, or throws when the file cannot be parsed. */
export function resolveBindingOptions(input: {
  root: string;
  configPath?: string;
  environment?: string;
  explicit?: MiniflareBindingOptions;
}): MiniflareBindingOptions {
  const file = findWranglerConfig(input.root, input.configPath);
  const fromConfig = file
    ? bindingsFromWranglerConfig(
        parseWranglerConfig(readFileSync(file, "utf-8"), file),
        input.environment
      )
    : {};
  return mergeBindingOptions(fromConfig, input.explicit);
}
