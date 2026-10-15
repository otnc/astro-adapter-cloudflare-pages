import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { detectTool } from "./index.js";

const dirs: string[] = [];

function projectWith(files: string[]): URL {
  const dir = mkdtempSync(join(tmpdir(), "acp-tool-"));
  dirs.push(dir);
  for (const file of files) writeFileSync(join(dir, file), "");
  return pathToFileURL(`${dir}/`);
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("detectTool", () => {
  it("respects an explicit tool", () => {
    expect(detectTool("cf", projectWith(["wrangler.jsonc"]))).toBe("cf");
  });

  it("prefers cf when a cloudflare.config file exists", () => {
    expect(
      detectTool("auto", projectWith(["cloudflare.config.ts", "wrangler.toml"]))
    ).toBe("cf");
  });

  it("never detects Miniflare, which reads no config file", () => {
    expect(detectTool("auto", projectWith(["miniflare.config.js"]))).toBe(
      "wrangler"
    );
    expect(detectTool("miniflare", projectWith([]))).toBe("miniflare");
  });

  it("defaults to Wrangler", () => {
    expect(detectTool("auto", projectWith(["wrangler.jsonc"]))).toBe(
      "wrangler"
    );
    expect(detectTool("auto", projectWith([]))).toBe("wrangler");
  });
});
