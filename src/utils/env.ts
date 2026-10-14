/**
 * Creates the `getEnv` function that `astro:env` uses to read server variables and secrets from Cloudflare bindings.
 *
 * Only string-like values are exposed: numbers and booleans are stringified, while bindings such as KV namespaces resolve to `undefined`.
 *
 * @example
 * ```ts
 * setGetEnv(createGetEnv(env));
 * ```
 */
export function createGetEnv(
  env: Record<string, unknown>
): (key: string) => string | undefined {
  return (key) => {
    const value = env[key];
    if (typeof value === "undefined" || typeof value === "string") {
      return value;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return value.toString();
    }
    return undefined;
  };
}
