import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { messages } from "./messages.js";

const SRC = fileURLToPath(new URL(".", import.meta.url));

/** Calls each message with sample arguments, so function messages are checked too. */
function renderAll(): Array<[name: string, text: string]> {
  return Object.entries(messages).map(([name, message]) => {
    const text =
      typeof message === "function"
        ? (message as (...args: unknown[]) => string)(
            ...Array.from({ length: message.length }, (_, index) =>
              index === 0 ? 3 : "sample"
            )
          )
        : message;
    return [name, text];
  });
}

describe("messages", () => {
  it.each(renderAll())("%s is one line of plain ASCII", (_name, text) => {
    // Emoji and box-drawing characters turn into garbage in some Windows terminals.
    expect(text).toMatch(/^[\x20-\x7e]+$/);
  });

  it.each(renderAll())("%s reads as sentences", (_name, text) => {
    expect(text.endsWith(".")).toBe(true);
    expect(text).not.toMatch(/\s{2,}/);
    expect(text).toBe(text.trim());
    // A sentence starts with a capital letter, or with code in backticks.
    expect(text[0]).toMatch(/[A-Z`]/);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ts$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !/\.test\.ts$/.test(file));
}

function isNotAscii(text: string): boolean {
  return [...text].some((character) => character.charCodeAt(0) > 127);
}

describe("logging", () => {
  it("goes through log.ts, so every message has the same form", () => {
    const direct = sourceFiles(SRC)
      .filter((file) => relative(SRC, file) !== "log.ts")
      .filter((file) =>
        /\blogger\.(info|warn|error|debug)\(|\bconsole\./.test(
          readFileSync(file, "utf-8")
        )
      )
      .map((file) => relative(SRC, file));
    expect(direct).toEqual([]);
  });

  it("keeps non-ASCII characters out of the source of the Worker and the adapter", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => isNotAscii(readFileSync(file, "utf-8")))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
