# Contributing

Thanks for your interest in improving astro-adapter-cloudflare-pages! This guide gets you set up and explains how the project is put together. If anything here is unclear, opening an issue to ask is welcome. To report a security problem, follow [SECURITY.md](./SECURITY.md) instead of opening an issue.

## Getting set up

Develop on Node.js 22, the lowest supported version (>= 22.12.0). `.nvmrc` pins the 22 line, so fnm (with `--use-on-cd`) or nvm switch to it automatically. Config files are plain JavaScript so they run on Node.js 22 without a TypeScript loader. Then install the dependencies:

```sh
npm install
```

`npm install` also installs the Git hooks (simple-git-hooks): `pre-commit` formats and lints the staged files with lint-staged, and `commit-msg` checks the message with commitlint. Commit the lockfile (`package-lock.json`).

On npm 11, npm runs install scripts only for the packages listed in `allowScripts` in `package.json` (currently `esbuild` and `workerd`, which check their platform binaries). If `npm install` reports a new package with an install script, review it before adding it with `npm approve-scripts <package>`, and keep the entry name-only so version bumps do not drop it.

Dependabot opens weekly update pull requests for npm packages and GitHub Actions. Major updates of `astro`, `typescript`, and `@types/node` are ignored on purpose and adopted by hand. The `dependabot-auto-merge` workflow enables auto-merge (squash) on Dependabot pull requests whose largest update is a patch or minor version, so they merge once the required checks pass. Major updates stay open for manual review.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle ESM + type declarations with tsdown |
| `npm run test` | Run the unit tests once with vitest (`npm run test:watch` to keep them running) |
| `npm run test:e2e` | Build, pack the adapter, install it into an isolated project per Astro major (`ASTRO_MAJORS`, default `6,7`), build `test/fixtures/*` and check the responses from `wrangler pages dev` |
| `npm run check:skills` | Validate the skills in `skills/` (frontmatter, the `skills init` sections, and the skills CLI listing) |
| `npm run check:package` | Check the built package with publint and Are the Types Wrong (`exports`, `types`, ESM-only resolution). Run `npm run build` first. |
| `npm run test:coverage` | Run the unit tests with a coverage report |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run format` | Format the code, writing the fixes (Prettier) |
| `npm run format:check` | Check formatting without writing (Prettier) |
| `npm run lint` | Lint the code without writing fixes (ESLint) |
| `npm run lint:fix` | Lint the code, writing the fixes (ESLint) |
| `npm run check` | Format and lint, writing the fixes (Prettier + ESLint) |
| `npm run ci` | The same checks without writing (what CI runs) |

Before opening a pull request, make sure the full set passes:

```sh
npm run ci && npm run typecheck && npm run test && npm run build && npm run test:e2e
```

The e2e tests keep their isolated projects in `.cache/e2e` (git-ignored), so later runs only reinstall when the dependencies change.

## Conventions

- **Formatting is Prettier** (`.prettierrc.json`) and **linting is ESLint** (`eslint.config.js`, `typescript-eslint`'s recommended rules, with `eslint-config-prettier` disabling any ESLint rule that would conflict with Prettier's formatting). The `pre-commit` hook runs both on staged files.
- **Unit tests live next to the code** as `*.test.ts`. End-to-end tests live in `test/e2e`, and the sites they build in `test/fixtures`.
- **Comments and docs are in English** and kept brief. Do not break a sentence across lines; wrap only at paragraph, list item, heading, or code block boundaries.
- **Type-only imports use `import type`** (`verbatimModuleSyntax` is on).
- **Version-specific code goes in `src/compat/`** and **tool-specific code in `src/tooling/`**, so the hooks in `src/index.ts` stay free of Astro version checks and of Wrangler or `cf` details.
- **Record experiments in `docs/compat-notes.md`** (and `docs/cf-notes.md` for the `cf` CLI), including negative results.

## Branches

`main` is always releasable, and every change reaches it through a pull request. A repository ruleset enforces this: pull requests only (squash merge), required checks, and no force pushes or deletion.

Create a short-lived branch from the latest `main`, named `<type>/<short-kebab-description>`, where `<type>` is one of the commit types below:

```text
feat/routes-json
fix/set-cookie-headers
docs/readme-usage
```

Keep your branch up to date by rebasing onto `main` rather than merging `main` into it. Branches are deleted after they are merged.

`release/<major>.x` branches (for example `release/1.x`) are created only when an older release line needs fixes after a new major ships. CI runs on them the same way as on `main`.

## Commit messages

Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), checked by commitlint (`commitlint.config.js`, based on `@commitlint/config-conventional`) in the `commit-msg` hook and on pull request titles in CI:

```text
<type>(<optional scope>): <summary>

<optional body: what changed and why>

<optional footer, e.g. BREAKING CHANGE: ... or Closes #12>
```

| Type | Use for |
| --- | --- |
| `feat` | A new user-facing feature or option |
| `fix` | A bug fix |
| `docs` | Documentation only (README, `docs/`, comments) |
| `style` | Formatting that does not change behavior |
| `test` | Adding or fixing tests and fixtures |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf` | A performance improvement |
| `build` | Build setup, packaging, or dependencies |
| `ci` | GitHub Actions workflows |
| `chore` | Maintenance that fits nothing above (tooling config, agent skills under `.agents/`) |
| `revert` | Reverting an earlier commit |

Scopes are optional. The known ones are `compat`, `routes`, `runtime`, `tooling`, `skills` (the user-facing skills under `skills/`), `deps` and `deps-dev` (used by Dependabot); commitlint warns about others. `release:` commits are created only by the `release` workflow.

- Write the summary in the imperative mood, in lowercase, without a trailing period, and keep the whole header within 100 characters (aim for about 72): `feat(routes): generate _routes.json from resolved routes`.
- Mark breaking changes with `!` after the type or scope and a `BREAKING CHANGE:` footer that explains how to migrate: `feat(compat)!: drop Astro 6 support`.
- Write the body as prose, one paragraph per line, and explain why rather than what.
- One logical change per commit. Do not mix formatting changes with behavior changes.

`CHANGELOG.md` is generated from these messages at release time (see below), so the type decides where a change is listed: `feat`, `fix`, `perf`, `refactor` and `docs` appear in the changelog, everything else does not.

## Pull requests

- Keep each pull request focused and add tests for any new behaviour.
- The pull request title must be a Conventional Commit message (the `pr-title` check runs commitlint on it), because pull requests are squash-merged and the title becomes the commit on `main`.
- Fill in the pull request template and make sure the full check set above passes. Required checks: `test (22)`, `test (24)`, `e2e (6)`, `e2e (7)` and `conventional-title`. CI also scans the history for secrets with gitleaks.
- Any change to a hook, an option, or a supported Astro version must update the matching skill under `skills/` and `docs/compat-notes.md` in the same pull request.

## Agent skills

This repository has two skill directories:

- `skills/` holds the skills shipped to users of the adapter. Create a new one with `cd skills && npx skills init <name>` (passing a path such as `skills/<name>` would put the path into `name`) and keep the template's structure: frontmatter with `name` and `description` (say when to use the skill and when not to), a heading with the name, a short summary, then `## When to use` and `## Instructions`. Long tables go in a `references/` file next to `SKILL.md`. `npm run check:skills` enforces this, and CI runs it.
- `.agents/skills/` holds third-party skills for developing this repository. They are managed with the [skills CLI](https://github.com/vercel-labs/skills) and pinned in `skills-lock.json`, which also keeps them out of `npx skills add otnc/astro-adapter-cloudflare-pages`. Claude Code reads them through symlinks in `.claude/skills/`, which is git-ignored; run `npm run skills:link` to create those links after cloning.

Instructions for coding agents are in [AGENTS.md](./AGENTS.md).

## Releasing (maintainers)

Releasing is one manual step. From the Actions tab, run the `release` workflow (`workflow_dispatch`) and give it a `version` input: either a bump keyword (`patch` / `minor` / `major` / `prerelease`) or an explicit version like `0.1.0`.

The workflow runs the checks, the unit tests and the e2e tests, bumps `package.json`, builds, regenerates `CHANGELOG.md` with [git-cliff](https://git-cliff.org) (`cliff.toml`), publishes to npm with provenance via **trusted publishing** (OIDC, no `NPM_TOKEN` needed), pushes the version commit and tag, and creates a GitHub Release whose notes are the new changelog section. Do not edit `CHANGELOG.md` by hand. If a run fails after publishing, run the workflow again with the same version: it skips publishing a version that is already on npm and finishes the commit, tag and GitHub Release. Git hooks are skipped in the workflow (`SKIP_SIMPLE_GIT_HOOKS=1`), because the reserved `release:` commits do not pass commitlint.

`main` is protected by a repository ruleset. Only a dedicated GitHub App may bypass it, so the workflow pushes the version commit with that app's token. The app needs **Contents: Read and write** on this repository only, its client ID in the `RELEASE_APP_CLIENT_ID` Actions variable, and its private key in the `RELEASE_APP_PRIVATE_KEY` Actions secret.

Trusted publishing must be configured once on npmjs.com: package **Settings → Publishing access → Trusted publishers → GitHub**, pointing at this repository's `release.yml` workflow.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
