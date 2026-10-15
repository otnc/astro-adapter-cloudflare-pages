import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

/** Lists the files below a directory as relative paths with forward slashes, or nothing when the directory does not exist. */
export async function listFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        relative(root, join(entry.parentPath, entry.name)).replace(/\\/g, "/")
      );
  } catch {
    return [];
  }
}

/** Whether a file can be read. */
export async function fileExists(file: URL | string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

/** Reads a text file, or returns `undefined` when it does not exist. */
export function readTextFile(file: URL | string): Promise<string | undefined> {
  return readFile(file, "utf-8").catch(() => undefined);
}

/** Wraps a path in slashes and collapses repeated ones: `docs` becomes `/docs/`. */
export function withSlashes(path: string): string {
  return `/${path}/`.replace(/\/+/g, "/");
}
