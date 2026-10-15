import { messages } from "../messages.js";
import type { PagesExecutionContext, Runtime } from "../types.js";

interface RuntimeSource<Env> {
  env: Env;
  cf: Runtime["runtime"]["cf"];
  caches: Runtime["runtime"]["caches"];
  /** The execution context of the request, or of the local runtime in `astro dev`. */
  context: { waitUntil(promise: Promise<unknown>): void };
}

/**
 * Builds `Astro.locals` for a request: `runtime` in the shape of `@astrojs/cloudflare` v12, and `cfContext`, the name later versions use. Production requests and `astro dev` share it, so both see the same object.
 */
export function createRuntimeLocals<Env>(
  source: RuntimeSource<Env>
): Runtime<Env> {
  const ctx: PagesExecutionContext = {
    waitUntil: (promise) => source.context.waitUntil(promise),
    passThroughOnException: () => {
      throw new Error(messages.passThroughUnsupported);
    },
    props: {},
  };
  return {
    runtime: {
      env: source.env,
      cf: source.cf,
      caches: source.caches,
      ctx,
    },
    cfContext: source.context as Runtime["cfContext"],
  };
}
