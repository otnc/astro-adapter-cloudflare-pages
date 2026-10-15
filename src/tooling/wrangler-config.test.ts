import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bindingsFromWranglerConfig,
  mergeBindingOptions,
  parseWranglerConfig,
  resolveBindingOptions,
  stripJsonc,
} from "./wrangler-config.js";

describe("stripJsonc", () => {
  it("removes comments and trailing commas but keeps strings", () => {
    const text = `{
      // line
      "url": "https://example.com/a,}", /* block */
      "list": [1, 2,],
    }`;
    expect(JSON.parse(stripJsonc(text))).toEqual({
      url: "https://example.com/a,}",
      list: [1, 2],
    });
  });
});

describe("parseWranglerConfig", () => {
  it("parses jsonc and toml to the same shape", () => {
    const jsonc = parseWranglerConfig(
      '{ "vars": { "A": "1" }, // c\n "kv_namespaces": [{ "binding": "KV" }] }',
      "wrangler.jsonc"
    );
    const toml = parseWranglerConfig(
      '[vars]\nA = "1"\n\n[[kv_namespaces]]\nbinding = "KV"\n',
      "wrangler.toml"
    );
    expect(toml).toEqual(jsonc);
  });
});

describe("bindingsFromWranglerConfig", () => {
  const config = {
    compatibility_date: "2026-10-01",
    compatibility_flags: ["nodejs_compat"],
    vars: { GREETING: "hi", COUNT: 3, NESTED: { a: 1 } },
    kv_namespaces: [{ binding: "KV", id: "x" }],
    d1_databases: [{ binding: "DB", database_name: "d", database_id: "i" }],
    r2_buckets: [{ binding: "FILES", bucket_name: "b" }],
    env: { staging: { vars: { GREETING: "staging" } } },
  };

  it("reads variables, namespaces, databases, buckets and compatibility", () => {
    expect(bindingsFromWranglerConfig(config)).toEqual({
      bindings: { GREETING: "hi", COUNT: 3 },
      kvNamespaces: ["KV"],
      d1Databases: ["DB"],
      r2Buckets: ["FILES"],
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat"],
    });
  });

  it("lets an environment replace the keys it sets", () => {
    const result = bindingsFromWranglerConfig(config, "staging");
    expect(result.bindings).toEqual({ GREETING: "staging" });
    expect(result.kvNamespaces).toEqual(["KV"]);
  });
});

describe("mergeBindingOptions", () => {
  it("lets the option win and joins names", () => {
    const merged = mergeBindingOptions(
      { bindings: { A: "file", B: "file" }, kvNamespaces: ["KV"] },
      {
        bindings: { A: "option" },
        kvNamespaces: ["KV", "OTHER"],
        persist: true,
      }
    );
    expect(merged).toEqual({
      bindings: { A: "option", B: "file" },
      kvNamespaces: ["KV", "OTHER"],
      persist: true,
    });
  });
});

describe("resolveBindingOptions", () => {
  it("reads wrangler.toml from the project root", () => {
    const root = mkdtempSync(join(tmpdir(), "wrangler-config-"));
    writeFileSync(join(root, "wrangler.toml"), '[vars]\nA = "toml"\n');
    expect(resolveBindingOptions({ root })).toEqual({
      bindings: { A: "toml" },
    });
  });

  it("returns only the option when there is no config file", () => {
    const root = mkdtempSync(join(tmpdir(), "wrangler-config-"));
    expect(
      resolveBindingOptions({ root, explicit: { r2Buckets: ["B"] } })
    ).toEqual({ r2Buckets: ["B"] });
  });
});
