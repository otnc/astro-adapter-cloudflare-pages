import type { AstroIntegrationLogger } from "astro";

/** The part of Astro's integration logger the adapter uses. */
export type Logger = Pick<AstroIntegrationLogger, "info" | "warn" | "error">;

/** The text of a caught value: the stack of an error, or the value as a string. */
export function describeError(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

/**
 * The one way the adapter writes to the console: through Astro's logger, which adds the adapter name and takes care of colors and the terminal. Texts come from `messages.ts`.
 *
 * @example
 * ```ts
 * log.warn(logger, messages.wranglerMissing);
 * ```
 */
export const log = {
  info: (logger: Logger, message: string) => logger.info(message),
  warn: (logger: Logger, message: string) => logger.warn(message),
  error: (logger: Logger, message: string) => logger.error(message),
};
