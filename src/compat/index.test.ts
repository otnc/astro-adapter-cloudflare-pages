import { describe, expect, it, vi } from "vitest";
import { assertSupportedAstro, parseMajor, resolveCompat } from "./index.js";

const root = new URL("../../", import.meta.url);
const logger = { warn: vi.fn() } as unknown as Parameters<
  typeof assertSupportedAstro
>[2];

describe("resolveCompat", () => {
  it("parses the major version", () => {
    expect(parseMajor("7.3.8")).toBe(7);
    expect(parseMajor("6.0.0-beta.1")).toBe(6);
  });

  it("selects the layer of a tested major", () => {
    expect(resolveCompat(root, "6.4.8")).toMatchObject({
      major: 6,
      tested: true,
    });
    expect(resolveCompat(root, "7.3.8")).toMatchObject({
      major: 7,
      tested: true,
    });
  });

  it("falls back to the newest layer for an untested major", () => {
    expect(resolveCompat(root, "8.0.0")).toMatchObject({
      major: 7,
      tested: false,
    });
  });

  it("reads the installed Astro version", () => {
    expect(resolveCompat(root).astroVersion).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("assertSupportedAstro", () => {
  it("throws on an untested major", () => {
    expect(() =>
      assertSupportedAstro(resolveCompat(root, "8.0.0"), false, logger)
    ).toThrow(/Astro 8\.0\.0/);
  });

  it("only warns when untested majors are allowed", () => {
    assertSupportedAstro(resolveCompat(root, "8.0.0"), true, logger);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
