import { join } from "node:path";
import type { MiniflareBindingOptions } from "../tooling/platform-proxy.js";
import { toMiniflareBindings } from "../tooling/miniflare-options.js";
import { listFiles } from "../utils/files.js";
import { createAssetsBinding } from "./assets.js";

// Old enough for most Miniflare releases. A date the installed workerd does not support, whether set here or in the Wrangler config, is retried with the newest date it reports.
const COMPATIBILITY_DATE = "2026-08-01";

/** Every module of the Worker, declared one by one because Miniflare cannot follow the dynamic imports in the bundle. `.wasm` files are the WebAssembly modules that `cloudflareModules` emits. */
async function listModules(
  workerDir: string
): Promise<{ type: "ESModule" | "CompiledWasm"; path: string }[]> {
  const modules: { type: "ESModule" | "CompiledWasm"; path: string }[] = [];
  for (const file of await listFiles(workerDir)) {
    const path = join(workerDir, file);
    if (/\.m?js$/.test(file)) modules.push({ type: "ESModule", path });
    else if (file.endsWith(".wasm"))
      modules.push({ type: "CompiledWasm", path });
  }
  // Miniflare runs the first module as the entry.
  const entry = join(workerDir, "index.js");
  return modules.sort(
    (a, b) => Number(b.path === entry) - Number(a.path === entry)
  );
}

/** Starts the built `_worker.js` in Miniflare, with the static files behind an `ASSETS` binding. */
export async function startWorker(
  workerDir: string,
  outDir: string,
  options: MiniflareBindingOptions
) {
  const { Miniflare, Response } = await import("miniflare");
  const modules = await listModules(workerDir);
  const create = (compatibilityDate: string) =>
    new Miniflare({
      modules,
      modulesRoot: workerDir,
      compatibilityDate,
      ...(options.compatibilityFlags && {
        compatibilityFlags: options.compatibilityFlags,
      }),
      ...toMiniflareBindings(options),
      serviceBindings: {
        // Stands in for the static asset binding that Pages gives every _worker.js.
        ASSETS: createAssetsBinding(
          outDir,
          Response as unknown as typeof globalThis.Response
        ),
      },
    });

  const wanted = options.compatibilityDate ?? COMPATIBILITY_DATE;
  let mf = create(wanted);
  try {
    await mf.ready;
  } catch (error) {
    await mf.dispose().catch(() => {});
    const newest =
      /newest date supported by this server binary is "(\d{4}-\d{2}-\d{2})"/.exec(
        String(error instanceof Error ? error.message : error)
      )?.[1];
    if (!newest) throw error;
    mf = create(newest);
    await mf.ready;
  }
  return mf;
}
