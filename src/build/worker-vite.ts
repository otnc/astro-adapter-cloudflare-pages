import type { HookParameters } from "astro";
import type { ResolvedCompat } from "../compat/index.js";
import { PACKAGE_NAME } from "../options.js";

type ViteConfig = HookParameters<"astro:build:setup">["vite"];

/** Leaves `cloudflare:*` imports (such as `cloudflare:workers`) to the runtime. */
export function cloudflareImportsPlugin() {
  return {
    name: `${PACKAGE_NAME}:cloudflare-imports`,
    enforce: "pre" as const,
    resolveId(source: string) {
      return source.startsWith("cloudflare:")
        ? { id: source, external: true }
        : null;
    },
  };
}

/** Adds this package to the modules that the prerender environment bundles, whatever it had before. */
function bundleAdapterWhenPrerendering(vite: ViteConfig): void {
  const prerender = ((vite.environments ??= {}).prerender ??= {});
  const noExternal = prerender.resolve?.noExternal;
  if (noExternal === true) return;
  prerender.resolve = {
    ...prerender.resolve,
    noExternal: [
      ...(Array.isArray(noExternal)
        ? noExternal
        : noExternal
          ? [noExternal]
          : []),
      PACKAGE_NAME,
    ],
  };
}

/**
 * Shapes the server build for workerd: one module, bundled dependencies, and the `workerd` and `worker` resolve conditions.
 *
 * It runs in `astro:build:setup` because Astro 6 rebuilds the config of the prerender and ssr environments from scratch, so options set earlier are lost.
 */
export function configureWorkerBuild(
  vite: ViteConfig,
  compat: ResolvedCompat
): void {
  compat.bundleServerAsOneModule(vite);
  bundleAdapterWhenPrerendering(vite);
  vite.ssr ??= {};
  vite.ssr.target = "webworker";
  vite.ssr.noExternal = true;
  vite.ssr.resolve ??= {};
  vite.ssr.resolve.conditions = [
    "workerd",
    "worker",
    "browser",
    "module",
    "import",
    "default",
  ];
}
