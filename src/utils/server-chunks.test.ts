import { describe, expect, it } from "vitest";
import { inlineEntryFacade, parseEntryFacade } from "./server-chunks.js";

describe("parseEntryFacade", () => {
  it("maps the chunk's export names to the entry's export names", () => {
    expect(
      parseEntryFacade(
        "export { $ as default, a as file, b as url } from '../index.js';\n"
      )
    ).toEqual(
      new Map([
        ["default", "$"],
        ["file", "a"],
        ["url", "b"],
      ])
    );
  });

  it("ignores chunks with their own code", () => {
    expect(
      parseEntryFacade("import x from '../index.js';\nexport default x;")
    ).toBeUndefined();
    expect(parseEntryFacade("export { a } from './other.js';")).toBeUndefined();
  });
});

describe("inlineEntryFacade", () => {
  const entry = [
    "const Island = {}; const file = 'x'; const handler = {};",
    'const map = new Map([["Island", () => import("./chunks/Island_x.mjs")]]);',
    "export { Island as $, file as a, handler as default };",
  ].join("\n");
  const names = new Map([
    ["default", "$"],
    ["file", "a"],
  ]);

  it("returns the entry's own bindings instead of importing the chunk", () => {
    const result = inlineEntryFacade(entry, "chunks/Island_x.mjs", names);
    expect(result).toContain(
      '() => Promise.resolve({ "default": Island, "file": file })'
    );
    expect(result).not.toContain("chunks/Island_x.mjs");
  });

  it("removes the exports that existed only for the chunk", () => {
    expect(inlineEntryFacade(entry, "chunks/Island_x.mjs", names)).toContain(
      "export { handler as default };"
    );
  });

  it("only rewrites the export list at the end of the entry", () => {
    const withString = `const text = "export { file as a };";
${entry}`;
    expect(
      inlineEntryFacade(withString, "chunks/Island_x.mjs", names)
    ).toContain('const text = "export { file as a };";');
  });

  it("keeps bundler names that contain dollar signs intact", () => {
    const dollarEntry = [
      "const $$Island$1 = {};",
      'const map = () => import("./chunks/Island_x.mjs");',
      "export { $$Island$1 as $ };",
    ].join("\n");
    expect(
      inlineEntryFacade(
        dollarEntry,
        "chunks/Island_x.mjs",
        new Map([["default", "$"]])
      )
    ).toContain('Promise.resolve({ "default": $$Island$1 })');
  });

  it("leaves the entry alone when it does not import the chunk", () => {
    expect(inlineEntryFacade(entry, "chunks/Other.mjs", names)).toBe(entry);
  });
});
