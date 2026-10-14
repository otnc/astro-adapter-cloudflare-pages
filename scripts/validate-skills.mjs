// Validates the user-facing skills in skills/ against the skills CLI format (the template from `npx skills init`) and the Agent Skills spec: a SKILL.md whose frontmatter has a unique `name` (lowercase and hyphens, at most 64 characters) matching the directory and a `description` of at most 1024 characters, a body with "When to use" and "Instructions" sections, and a listing by the skills CLI that contains exactly these skills.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = "skills";
const errors = [];

function frontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return undefined;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (field) fields[field[1]] = field[2].trim();
  }
  return fields;
}

const directories = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const names = new Set();

for (const directory of directories) {
  const file = join(SKILLS_DIR, directory, "SKILL.md");
  if (!existsSync(file)) {
    errors.push(`${directory}: SKILL.md is missing`);
    continue;
  }
  const source = readFileSync(file, "utf-8");
  const fields = frontmatter(source);
  if (!fields) {
    errors.push(`${file}: frontmatter is missing`);
    continue;
  }
  if (fields.name !== directory) {
    errors.push(
      `${file}: name "${fields.name}" must match the directory "${directory}"`
    );
  }
  if (
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name ?? "") ||
    fields.name.length > 64
  ) {
    errors.push(
      `${file}: name must be lowercase words joined by hyphens, at most 64 characters`
    );
  }
  if (!fields.description) errors.push(`${file}: description is missing`);
  else if (fields.description.length > 1024) {
    errors.push(`${file}: description is longer than 1024 characters`);
  }
  for (const heading of ["## When to use", "## Instructions"]) {
    if (!source.includes(`\n${heading}\n`))
      errors.push(
        `${file}: the "${heading}" section from the skills init template is missing`
      );
  }
  if (names.has(fields.name))
    errors.push(`${file}: duplicate name "${fields.name}"`);
  names.add(fields.name);
}

// The skills CLI must find exactly these skills, and none of the development skills pinned in skills-lock.json. It is not a dev dependency, so run the latest version through npx (the arguments are constant, so the Windows shell is safe here).
const SKILLS_CLI = "skills";
const cli = spawnSync("npx", ["--yes", SKILLS_CLI, "add", ".", "--list"], {
  encoding: "utf-8",
  shell: process.platform === "win32",
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
});
if (cli.status !== 0) {
  errors.push(`\`npx ${SKILLS_CLI} add . --list\` failed:\n${cli.stderr}`);
}
const listed = new Set(
  (cli.stdout + cli.stderr)
    .split(/\r?\n/)
    .map((line) => /^\W*([a-z0-9-]+)\s*$/.exec(line)?.[1])
    .filter(Boolean)
);
for (const name of names) {
  if (!listed.has(name)) errors.push(`skills CLI does not list "${name}"`);
}
const lock = JSON.parse(readFileSync("skills-lock.json", "utf-8"));
for (const name of Object.keys(lock.skills)) {
  if (listed.has(name))
    errors.push(`skills CLI offers the development skill "${name}" to users`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `✖ ${error}`).join("\n"));
  process.exit(1);
}
console.log(`✔ ${names.size} skills are valid: ${[...names].join(", ")}`);
