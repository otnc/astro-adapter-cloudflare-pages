import { readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles } from "../utils/files.js";
import { inlineEntryFacade, parseEntryFacade } from "../utils/server-chunks.js";

/**
 * Pages re-bundles `_worker.js/` and cannot resolve chunks that import back from the entry, so this folds such re-export-only chunks into the entry and deletes them.
 */
export async function inlineEntryFacades(serverDir: URL): Promise<void> {
  const root = fileURLToPath(serverDir);
  const entryFile = join(root, "index.js");
  let entry: string;
  try {
    entry = await readFile(entryFile, "utf-8");
  } catch {
    return;
  }

  let changed = false;
  const emptiedDirs = new Set<string>();
  for (const relativePath of await listFiles(root)) {
    if (!/\.m?js$/.test(relativePath) || relativePath === "index.js") continue;
    const file = join(root, relativePath);
    const names = parseEntryFacade(await readFile(file, "utf-8"));
    if (!names) continue;
    const rewritten = inlineEntryFacade(entry, relativePath, names);
    if (rewritten === entry) continue;
    entry = rewritten;
    changed = true;
    await rm(file);
    emptiedDirs.add(dirname(file));
  }

  if (changed) await writeFile(entryFile, entry, "utf-8");
  for (const dir of emptiedDirs) {
    // rmdir removes only empty directories, so a folder that still holds other chunks stays.
    await rmdir(dir).catch(() => {});
  }
}
