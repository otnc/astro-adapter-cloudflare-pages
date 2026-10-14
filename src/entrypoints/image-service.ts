// Ported from `@astrojs/cloudflare` v12 (`entrypoints/image-service.js`), MIT License, Copyright (c) 2021 Fred K. Schott.
import type { ExternalImageService } from "astro";
import { baseService } from "astro/assets";
import { isESMImportedImage, isRemoteAllowed } from "astro/assets/utils";

/** Joins path segments into one root-relative path, for example `/docs/cdn-cgi/image/...`. */
function joinPaths(...paths: string[]): string {
  return `/${paths
    .map((path) => path.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

/**
 * Image service that serves images through Cloudflare Images transformations (`/cdn-cgi/image/...`). The zone must have Image Transformations enabled. Images that are neither imported nor allowed remote images are left unchanged.
 */
const service: ExternalImageService = {
  ...baseService,
  getURL(options, imageConfig) {
    const params = ["onerror=redirect"];
    if (options.width) params.push(`width=${options.width}`);
    if (options.height) params.push(`height=${options.height}`);
    if (options.quality) params.push(`quality=${options.quality}`);
    if (options.fit) params.push(`fit=${options.fit}`);
    if (options.format) params.push(`format=${options.format}`);

    let source: string;
    if (isESMImportedImage(options.src)) {
      source = options.src.src;
    } else if (
      typeof options.src === "string" &&
      isRemoteAllowed(options.src, imageConfig)
    ) {
      source = options.src;
    } else {
      // Neither imported nor an allowed remote image: keep the original URL.
      return options.src as string;
    }
    return joinPaths(
      import.meta.env.BASE_URL,
      "/cdn-cgi/image",
      params.join(","),
      source
    );
  },
};

export default service;
