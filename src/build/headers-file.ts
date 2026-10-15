import { writeFile } from "node:fs/promises";
import { log, type Logger } from "../log.js";
import { messages } from "../messages.js";
import { readTextFile } from "../utils/files.js";
import {
  PAGES_HEADER_RULE_LIMIT,
  countHeaderRules,
  mergeHeadersFile,
  type HeaderRule,
} from "../utils/static-headers.js";

/** Appends the generated rules to `_headers` in the output, after the rules copied from `public/`. */
export async function writeHeadersFile(
  outDir: URL,
  rules: HeaderRule[],
  logger: Logger
): Promise<void> {
  const file = new URL("./_headers", outDir);
  const existing = await readTextFile(file);
  const merged = mergeHeadersFile(existing, rules);
  if (merged === (existing ?? "")) return;
  await writeFile(file, merged, "utf-8");

  const count = countHeaderRules(merged);
  if (count > PAGES_HEADER_RULE_LIMIT) {
    log.warn(
      logger,
      messages.tooManyHeaderRules(count, PAGES_HEADER_RULE_LIMIT)
    );
  }
}
