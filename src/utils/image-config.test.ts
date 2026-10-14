import type { AstroConfig, AstroIntegrationLogger } from "astro";
import { describe, expect, it, vi } from "vitest";
import {
  CLOUDFLARE_SERVICE_ENTRYPOINT,
  SHARP_SERVICE_ENTRYPOINT,
  resolveImageSetup,
} from "./image-config.js";

const logger = { info: vi.fn() } as unknown as AstroIntegrationLogger;

function configWith(entrypoint: string): AstroConfig {
  return {
    image: { service: { entrypoint, config: {} } },
  } as unknown as AstroConfig;
}

const sharp = configWith(SHARP_SERVICE_ENTRYPOINT);

describe("resolveImageSetup", () => {
  it('defaults to "compile": keeps sharp and swaps it in the Worker', () => {
    expect(resolveImageSetup(undefined, sharp, "build", logger)).toEqual({
      service: undefined,
      swapSharpInWorker: true,
    });
  });

  it('switches to the passthrough service for "passthrough"', () => {
    const setup = resolveImageSetup("passthrough", sharp, "build", logger);
    expect(setup.service?.entrypoint).toBe("astro/assets/services/noop");
    expect(setup.swapSharpInWorker).toBe(false);
  });

  it('uses the Cloudflare service for "cloudflare" builds, and sharp in dev', () => {
    expect(
      resolveImageSetup("cloudflare", sharp, "build", logger).service
    ).toEqual({ entrypoint: CLOUDFLARE_SERVICE_ENTRYPOINT, config: {} });
    expect(
      resolveImageSetup("cloudflare", sharp, "dev", logger).service
    ).toBeUndefined();
  });

  it('keeps the configured service for "custom"', () => {
    expect(resolveImageSetup("custom", sharp, "build", logger)).toEqual({
      service: undefined,
      swapSharpInWorker: false,
    });
  });

  it("keeps a non-sharp service even in compile mode", () => {
    expect(
      resolveImageSetup("compile", configWith("my-service"), "build", logger)
    ).toEqual({ service: undefined, swapSharpInWorker: false });
  });
});
