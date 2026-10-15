import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, posix } from "node:path";
import { PACKAGE_NAME } from "../options.js";
import type { VitePlugin } from "./vite-plugin.js";

/** Marks an import of an emitted `.wasm` file until `renderChunk` knows where the importing chunk lives. */
const MARKER = "__ASTRO_ADAPTER_CLOUDFLARE_PAGES_MODULE__";
/** The id every module file is loaded under. It does not end in the file's extension, so no other loader (such as Vite's for `.txt`) wraps the generated code a second time. */
const VIRTUAL_ID = "\0astro-adapter-cloudflare-pages-module.js";
const MODULE_FILE = /\.(wasm|bin|txt)(?:\?module)?$/;

export type ModuleKind = "wasm" | "data" | "text";

/** Which kind of module a file is, from its name: `.wasm` (also `.wasm?module`), `.bin` and `.txt`. */
export function moduleKindOf(id: string): ModuleKind | undefined {
  const extension = MODULE_FILE.exec(id)?.[1];
  if (extension === "wasm") return "wasm";
  if (extension === "bin") return "data";
  if (extension === "txt") return "text";
  return undefined;
}

/**
 * JavaScript that exports the file as a module of its kind, with the bytes inside the code: a compiled WebAssembly module, an `ArrayBuffer`, or a string. Node.js can run it (prerendering, `astro dev`); workerd cannot create WebAssembly from bytes, so Worker builds use a file for `.wasm` instead.
 */
export function renderInlineModule(kind: ModuleKind, data: Buffer): string {
  const base64 = data.toString("base64");
  const bytes = `Uint8Array.from(atob("${base64}"), (c) => c.charCodeAt(0))`;
  switch (kind) {
    case "wasm":
      return `export default new WebAssembly.Module(${bytes});`;
    case "data":
      return `export default ${bytes}.buffer;`;
    case "text":
      return `export default ${JSON.stringify(data.toString("utf-8"))};`;
  }
}

/** The name of the emitted file: the original name, a hash of the content, and the extension. */
export function emittedName(file: string, data: Buffer): string {
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 8);
  return `${basename(file, ".wasm")}.${hash}.wasm`;
}

/** The import path from a chunk to an emitted file, always relative: `./a.wasm` or `../a.wasm`. */
export function importPath(
  chunkFileName: string,
  emittedFileName: string
): string {
  const relative = posix.relative(
    posix.dirname(chunkFileName),
    emittedFileName
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}

interface ResolveContext {
  resolve(
    source: string,
    importer: string | undefined,
    options: object
  ): Promise<{ id: string; external?: boolean | string } | null>;
}

interface LoadContext {
  emitFile(file: { type: "asset"; fileName: string; source: Buffer }): string;
  environment?: { name: string };
}

/**
 * Lets pages and endpoints import `.wasm`, `.bin` and `.txt` files, as `@astrojs/cloudflare` v12 did with `cloudflareModules`.
 *
 * In the Worker build, `.wasm` files become files next to the bundle that the bundle imports, which is the only way to load WebAssembly on Cloudflare, and Pages uploads them as modules. Everywhere else the bytes are inlined.
 */
export function cloudflareModulesPlugin(): VitePlugin {
  let building = false;
  const plugin = {
    name: `${PACKAGE_NAME}:cloudflare-modules`,
    enforce: "pre" as const,
    configResolved(config: { command: string }) {
      building = config.command === "build";
    },
    config() {
      // Only .wasm is added to the asset types: it keeps Vite from treating the file as source, while .bin and .txt are handled in load() and must not become assets first.
      return { assetsInclude: ["**/*.wasm"] };
    },
    async resolveId(
      this: ResolveContext,
      source: string,
      importer: string | undefined,
      options: object
    ) {
      if (source.startsWith(MARKER)) return { id: source, external: true };
      if (!moduleKindOf(source)) return null;
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (!resolved || resolved.external) return null;
      const file = resolved.id.replace(/\?module$/, "");
      const query = new URLSearchParams({
        file,
        kind: moduleKindOf(file) ?? "",
      });
      return `${VIRTUAL_ID}?${query}`;
    },
    async load(this: LoadContext, id: string) {
      if (!id.startsWith(`${VIRTUAL_ID}?`)) return null;
      const query = new URLSearchParams(id.slice(VIRTUAL_ID.length + 1));
      const file = query.get("file") ?? "";
      const kind = moduleKindOf(file);
      if (!kind) return null;
      const data = await readFile(file);
      if (kind === "wasm" && building && this.environment?.name === "ssr") {
        const fileName = emittedName(file, data);
        this.emitFile({ type: "asset", fileName, source: data });
        return {
          code: `import module from "${MARKER}${fileName}"; export default module;`,
          moduleType: "js",
        };
      }
      return { code: renderInlineModule(kind, data), moduleType: "js" };
    },
    renderChunk(code: string, chunk: { fileName: string }) {
      if (!code.includes(MARKER)) return null;
      return {
        code: code.replace(
          new RegExp(`${MARKER}([^"'\\s]+)`, "g"),
          (_match, fileName: string) => importPath(chunk.fileName, fileName)
        ),
        map: null,
      };
    },
  };
  return plugin as unknown as VitePlugin;
}
