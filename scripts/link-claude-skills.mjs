// Links every development skill in .agents/skills/ into .claude/skills/, which is git-ignored. `npx skills experimental_install` restores .agents/skills/ but only links universal agents, so Claude Code needs this after a clone.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";

const sourceDir = resolve(".agents/skills");
const linkDir = resolve(".claude/skills");

mkdirSync(linkDir, { recursive: true });

for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!existsSync(join(sourceDir, entry.name, "SKILL.md"))) continue;

  const linkPath = join(linkDir, entry.name);
  const alreadyLinked = lstatSync(linkPath, { throwIfNoEntry: false });
  if (alreadyLinked) continue;

  // "junction" needs no admin rights on Windows and is ignored elsewhere.
  symlinkSync(join(sourceDir, entry.name), linkPath, "junction");
  console.log(`linked ${entry.name}`);
}
