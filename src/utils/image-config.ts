import type { AstroConfig, AstroIntegrationLogger } from "astro";
import { passthroughImageService } from "astro/config";
import type { Plugin } from "vite";

export type ImageServiceOption =
  "compile" | "passthrough" | "cloudflare" | "custom";

export const SHARP_SERVICE_ENTRYPOINT = "astro/assets/services/sharp";
const NOOP_SERVICE_ENTRYPOINT = "astro/assets/services/noop";
export const CLOUDFLARE_SERVICE_ENTRYPOINT =
  "astro-adapter-cloudflare-pages/image-service";

type ImageService = ReturnType<typeof passthroughImageService>;

export interface ImageSetup {
  /** The image service to set, or `undefined` to keep the user's config. */
  service: ImageService | undefined;
  /** Whether the Worker build must swap sharp for the no-op service. */
  swapSharpInWorker: boolean;
}

/**
 * Decides the image service for an option. sharp cannot run in workerd, so on-demand pages never use it; `"compile"` keeps it for prerendered pages, which Astro 6 and 7 render in Node.js.
 */
export function resolveImageSetup(
  option: ImageServiceOption | undefined,
  config: AstroConfig,
  command: "dev" | "build" | "preview" | "sync",
  logger: AstroIntegrationLogger
): ImageSetup {
  const usesSharp =
    config.image.service.entrypoint === SHARP_SERVICE_ENTRYPOINT;
  const keep: ImageSetup = { service: undefined, swapSharpInWorker: false };

  switch (option ?? "compile") {
    case "custom":
      return keep;
    case "passthrough":
      return { service: passthroughImageService(), swapSharpInWorker: false };
    case "cloudflare":
      // Image transformations only exist on Cloudflare, so `astro dev` keeps resizing locally.
      return command === "dev"
        ? keep
        : {
            service: { entrypoint: CLOUDFLARE_SERVICE_ENTRYPOINT, config: {} },
            swapSharpInWorker: false,
          };
    case "compile":
      if (!usesSharp) return keep;
      if (command === "build") {
        logger.info(
          "Optimizing images of prerendered pages with sharp at build time; on-demand pages serve images unchanged."
        );
      }
      return { service: undefined, swapSharpInWorker: true };
  }
}

/**
 * Resolves the sharp image service to the no-op service in the Worker (`ssr`) environment only, so prerendering still optimizes images while the Worker bundle stays free of sharp and Node.js built-ins.
 */
export function swapSharpInWorker(): Plugin {
  return {
    name: "astro-adapter-cloudflare-pages:swap-sharp-in-worker",
    enforce: "pre",
    apply: "build",
    applyToEnvironment(environment) {
      return environment.name === "ssr";
    },
    async resolveId(source, importer, options) {
      if (source !== SHARP_SERVICE_ENTRYPOINT) return null;
      return this.resolve(NOOP_SERVICE_ENTRYPOINT, importer, {
        ...options,
        skipSelf: true,
      });
    },
  };
}
