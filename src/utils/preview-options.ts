import type { MiniflareBindingOptions } from "../tooling/platform-proxy.js";

const KEY = Symbol.for("astro-adapter-cloudflare-pages.preview-options");

/**
 * Hands the `platformProxy.miniflare` option to the preview entrypoint. Astro loads that entrypoint as a separate module in the same process, after the integration's `astro:config:done` hook has run, so a process-wide slot is the only channel between them.
 */
export function setPreviewOptions(
  options: MiniflareBindingOptions | undefined
): void {
  (globalThis as Record<symbol, unknown>)[KEY] = options;
}

export function getPreviewOptions(): MiniflareBindingOptions | undefined {
  return (globalThis as Record<symbol, unknown>)[KEY] as
    MiniflareBindingOptions | undefined;
}
