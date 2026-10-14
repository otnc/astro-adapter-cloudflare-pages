import { describe, expect, it } from "vitest";
import { createGetEnv } from "./env.js";

describe("createGetEnv", () => {
  const getEnv = createGetEnv({
    TEXT: "value",
    COUNT: 3,
    ENABLED: false,
    KV: { get() {} },
  });

  it("returns strings as they are", () => {
    expect(getEnv("TEXT")).toBe("value");
  });

  it("stringifies numbers and booleans", () => {
    expect(getEnv("COUNT")).toBe("3");
    expect(getEnv("ENABLED")).toBe("false");
  });

  it("hides bindings and missing keys", () => {
    expect(getEnv("KV")).toBeUndefined();
    expect(getEnv("MISSING")).toBeUndefined();
  });
});
