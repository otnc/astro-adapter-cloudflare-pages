import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

type MiniflareModule = typeof import("miniflare");
type MiniflareOptions = ConstructorParameters<MiniflareModule["Miniflare"]>[0];

/**
 * Imports the Miniflare that the project installed, falling back to the one Wrangler depends on. Resolving from the project, not from this package, finds Miniflare under strict layouts such as pnpm and when only Wrangler brings it in (Wrangler 4.151 and later depend on a Miniflare 5 beta).
 */
async function importMiniflare(root: URL): Promise<MiniflareModule> {
  const fromProject = createRequire(new URL("package.json", root));
  for (const resolve of [
    () => fromProject.resolve("miniflare"),
    () =>
      createRequire(fromProject.resolve("wrangler/package.json")).resolve(
        "miniflare"
      ),
  ]) {
    let path: string;
    try {
      path = resolve();
    } catch {
      continue;
    }
    return (await import(pathToFileURL(path).href)) as MiniflareModule;
  }
  return import("miniflare");
}

/**
 * Loads Miniflare and returns a function that creates an instance from the options of Miniflare 4. Miniflare 5 changed its options (a `workers` array of a new shape) and exports `convertV4MiniflareOptions` to translate the old ones, so the options are converted when that function exists.
 */
export async function loadMiniflare(root: URL) {
  const module = await importMiniflare(root);
  const { convertV4MiniflareOptions } = module as unknown as {
    convertV4MiniflareOptions?: (options: MiniflareOptions) => MiniflareOptions;
  };
  return {
    Response: module.Response,
    create: (options: MiniflareOptions) =>
      new module.Miniflare(
        convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options
      ),
  };
}
