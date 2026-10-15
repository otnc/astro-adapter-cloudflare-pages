import { createRequire } from "node:module";
import { AstroError } from "astro/errors";
import { log, type Logger } from "../log.js";
import { messages } from "../messages.js";
import { astro6 } from "./astro6.js";
import { astro7 } from "./astro7.js";
import type { AstroCompat } from "./types.js";

/** One entry per tested Astro major. Supporting a new major means adding its file and one line here. */
const COMPAT_BY_MAJOR: ReadonlyMap<number, AstroCompat> = new Map([
  [6, astro6],
  [7, astro7],
]);

export interface ResolvedCompat extends AstroCompat {
  astroVersion: string;
  tested: boolean;
}

function readAstroVersion(root: URL): string {
  const require = createRequire(new URL("./package.json", root));
  const { version } = require("astro/package.json") as { version: string };
  return version;
}

export function parseMajor(version: string): number {
  return Number.parseInt(version.split(".")[0] ?? "", 10);
}

/** Picks the compat layer for the installed Astro. An untested major falls back to the newest tested layer. */
export function resolveCompat(
  root: URL,
  astroVersion = readAstroVersion(root)
): ResolvedCompat {
  const major = parseMajor(astroVersion);
  const tested = COMPAT_BY_MAJOR.get(major);
  const newest = [...COMPAT_BY_MAJOR.entries()].sort(
    ([a], [b]) => b - a
  )[0]![1];
  return { ...(tested ?? newest), astroVersion, tested: tested !== undefined };
}

export function assertSupportedAstro(
  compat: ResolvedCompat,
  allowUntestedAstro: boolean,
  logger: Logger
): void {
  if (compat.tested) return;
  const testedMajors = [...COMPAT_BY_MAJOR.keys()].join(", ");
  const message = messages.untestedAstro(compat.astroVersion, testedMajors);
  if (!allowUntestedAstro) {
    throw new AstroError(message, messages.untestedAstroHint);
  }
  log.warn(logger, message);
}
