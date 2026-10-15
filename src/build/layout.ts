export type Target = "pages" | "workers";

export interface OutputLayout {
  /** Where the static files go: the build output for Pages, `client/` for Workers. */
  assets: URL;
  /** Where the Worker bundle goes: `_worker.js/` for Pages, `server/` for Workers. */
  server: URL;
}

/** The folders of the build output. Pages needs `_worker.js/` inside the folder it serves, and Workers keeps the Worker and its static assets in sibling folders. */
export function resolveLayout(
  target: Target | undefined,
  outDir: URL
): OutputLayout {
  return target === "workers"
    ? {
        assets: new URL("./client/", outDir),
        server: new URL("./server/", outDir),
      }
    : { assets: outDir, server: new URL("./_worker.js/", outDir) };
}
