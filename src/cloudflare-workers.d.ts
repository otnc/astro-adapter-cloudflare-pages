declare module "cloudflare:workers" {
  /** Bindings of the current Worker, available at module scope (compatibility date 2025-03-17 or later, or on Pages). */
  export const env: Record<string, unknown>;
}

interface ImportMeta {
  /** Replaced by Vite when the user's project bundles the image service. */
  readonly env: { readonly BASE_URL: string };
}
