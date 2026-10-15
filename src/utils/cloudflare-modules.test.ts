import { describe, expect, it } from "vitest";
import {
  emittedName,
  importPath,
  moduleKindOf,
  renderInlineModule,
} from "./cloudflare-modules.js";

describe("moduleKindOf", () => {
  it("recognizes wasm, bin and txt files", () => {
    expect(moduleKindOf("/src/add.wasm")).toBe("wasm");
    expect(moduleKindOf("/src/add.wasm?module")).toBe("wasm");
    expect(moduleKindOf("/src/blob.bin")).toBe("data");
    expect(moduleKindOf("/src/note.txt")).toBe("text");
  });

  it("leaves other files alone", () => {
    expect(moduleKindOf("/src/page.astro")).toBeUndefined();
    expect(moduleKindOf("/src/wasm.ts")).toBeUndefined();
    expect(moduleKindOf("/src/note.txt.map")).toBeUndefined();
  });
});

describe("renderInlineModule", () => {
  it("embeds text as a JSON string", () => {
    const code = renderInlineModule("text", Buffer.from('say "hi"\n'));
    expect(code).toBe('export default "say \\"hi\\"\\n";');
  });

  it("embeds bytes as base64 and decodes them at load", async () => {
    const bytes = Buffer.from([1, 2, 3, 250]);
    const code = renderInlineModule("data", bytes);
    expect(code).toContain(bytes.toString("base64"));
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
    );
    expect([...new Uint8Array(module.default as ArrayBuffer)]).toEqual([
      1, 2, 3, 250,
    ]);
  });

  it("compiles wasm bytes into a WebAssembly module", async () => {
    const wasm = Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]);
    const code = renderInlineModule("wasm", wasm);
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
    );
    const { WebAssembly: runtime } = globalThis as unknown as {
      WebAssembly: { Module: new (bytes: Uint8Array) => object };
    };
    expect(module.default).toBeInstanceOf(runtime.Module);
  });
});

describe("emittedName", () => {
  it("keeps the name and adds a content hash", () => {
    const first = emittedName("/src/add.wasm", Buffer.from("a"));
    expect(first).toMatch(/^add\.[0-9a-f]{8}\.wasm$/);
    expect(emittedName("/src/add.wasm", Buffer.from("b"))).not.toBe(first);
    expect(emittedName("/other/add.wasm", Buffer.from("a"))).toBe(first);
  });
});

describe("importPath", () => {
  it("is relative from the entry and from chunks in folders", () => {
    expect(importPath("index.js", "add.1.wasm")).toBe("./add.1.wasm");
    expect(importPath("chunks/page.mjs", "add.1.wasm")).toBe("../add.1.wasm");
    expect(importPath("chunks/a/b.mjs", "add.1.wasm")).toBe("../../add.1.wasm");
  });
});
