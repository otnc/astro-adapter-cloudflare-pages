import type { MiniflareBindingOptions } from "../tooling/platform-proxy.js";

export interface PreviewSettings {
  bindings: MiniflareBindingOptions;
  /** Where the static files are, when not the build output. */
  assetsDir: URL;
}

const KEY = Symbol.for("astro-adapter-cloudflare-pages.preview-options");

/**
 * Hands the bindings and the static files folder to the preview entrypoint. Astro loads that entrypoint as a separate module in the same process, after the integration's `astro:config:done` hook has run, so a process-wide slot is the only channel between them.
 */
export function setPreviewOptions(settings: PreviewSettings): void {
  (globalThis as Record<symbol, unknown>)[KEY] = settings;
}

export function getPreviewOptions(): PreviewSettings | undefined {
  return (globalThis as Record<symbol, unknown>)[KEY] as
    PreviewSettings | undefined;
}
