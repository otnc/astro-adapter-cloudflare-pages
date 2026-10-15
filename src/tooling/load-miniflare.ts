type MiniflareModule = typeof import("miniflare");
type MiniflareOptions = ConstructorParameters<MiniflareModule["Miniflare"]>[0];

/**
 * Loads Miniflare and returns a function that creates an instance from the options of Miniflare 4. Miniflare 5 changed its options (a `workers` array of a new shape) and exports `convertV4MiniflareOptions` to translate the old ones, so the options are converted when that function exists.
 */
export async function loadMiniflare() {
  const module = await import("miniflare");
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
