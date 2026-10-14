const FACADE = /^export\s*\{([^}]*)\}\s*from\s*["']\.\.\/index\.js["'];?$/;
// Rollup and rolldown put the entry's local export list last, optionally before a source map comment. Matching only there keeps the rewrite away from string literals in bundled code.
const EXPORT_LIST =
  /export\s*\{([^}]*)\}\s*;(?=\s*(?:\/\/# sourceMappingURL=\S+\s*)?$)/g;

function parseSpecifiers(
  list: string
): Array<[local: string, exported: string]> {
  return list
    .split(",")
    .map((specifier) => specifier.trim().split(/\s+as\s+/))
    .filter((parts) => parts[0])
    .map((parts) => [parts[0]!, parts[1] ?? parts[0]!]);
}

/**
 * Parses a chunk that only re-exports bindings of the entry, such as `export { $ as default, a as file } from '../index.js';`, and returns the chunk's export names mapped to the entry's export names. Returns `undefined` for any other chunk.
 */
export function parseEntryFacade(
  source: string
): Map<string, string> | undefined {
  const match = FACADE.exec(source.trim());
  if (!match) return undefined;
  return new Map(
    parseSpecifiers(match[1]!).map(([entryName, chunkName]) => [
      chunkName,
      entryName,
    ])
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Maps each name exported by local `export { ... };` statements to its local binding. */
function entryExports(entrySource: string): Map<string, string> {
  const exports = new Map<string, string>();
  for (const match of entrySource.matchAll(EXPORT_LIST)) {
    for (const [local, exported] of parseSpecifiers(match[1]!)) {
      exports.set(exported, local);
    }
  }
  return exports;
}

/**
 * Folds a re-export-only chunk into the server entry: `import("./chunks/<file>")` becomes a promise of the entry's own bindings, and the exports that existed only for the chunk are removed.
 *
 * Astro 6 emits server islands as such chunks, which import back from `../index.js`. Pages cannot run that layout: Wrangler fails to resolve the import when it re-bundles `_worker.js/`, and workerd treats every named export of the entry as a handler.
 */
export function inlineEntryFacade(
  entrySource: string,
  chunkPath: string,
  names: Map<string, string>
): string {
  const pattern = new RegExp(
    `import\\(\\s*(["'\`])\\./${escapeRegExp(chunkPath)}\\1\\s*\\)`,
    "g"
  );
  if (!pattern.test(entrySource)) return entrySource;

  const exports = entryExports(entrySource);
  const fields: string[] = [];
  for (const [chunkName, entryName] of names) {
    const local = exports.get(entryName);
    if (!local) return entrySource;
    fields.push(`${JSON.stringify(chunkName)}: ${local}`);
  }

  const removed = new Set(
    [...names.values()].filter((entryName) => entryName !== "default")
  );
  return (
    entrySource
      // A replacer function, because bundler names such as `$$Island$1` would be read as replacement patterns.
      .replace(pattern, () => `Promise.resolve({ ${fields.join(", ")} })`)
      .replace(EXPORT_LIST, (statement, list: string) => {
        const kept = parseSpecifiers(list).filter(
          ([, exported]) => !removed.has(exported)
        );
        if (kept.length === 0) return "";
        return `export { ${kept
          .map(([local, exported]) =>
            local === exported ? local : `${local} as ${exported}`
          )
          .join(", ")} };`;
      })
  );
}
