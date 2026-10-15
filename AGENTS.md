# AGENTS.md

Instructions for coding agents (Claude Code, Codex, and others) working in this repository. Human contributors should read [CONTRIBUTING.md](./CONTRIBUTING.md), which is the source of truth for the branch, commit, and pull request rules summarized here.

## Project

- `astro-adapter-cloudflare-pages` is an unofficial, community Astro adapter that deploys on-demand rendered Astro 6 and 7 sites to Cloudflare Pages. Astro 8 and later are planned.
- The official `@astrojs/cloudflare` dropped Pages support in v13 and targets Workers only. Never describe this package as official, and never use the `@astrojs` scope.
- Stack: TypeScript (`^6.0.3`, do not upgrade to 7 without asking), tsdown, Vitest, ESLint, Prettier, Node.js >= 22.12.0 (develop on 22, pinned in `.nvmrc`; keep config files in plain JavaScript). Dev dependencies include `astro` (7.x) and `wrangler`; `@cloudflare/workers-types` and `@astrojs/underscore-redirects` are runtime dependencies.

## Commands

```sh
npm install
npm run check      # format and lint, writing fixes
npm run ci         # format and lint checks without writing (what CI runs)
npm run typecheck
npm run test
npm run build
npm run test:e2e   # Astro 6 and 7 fixtures on wrangler pages dev (ASTRO_MAJORS=6,7)
```

Run `npm run ci && npm run typecheck && npm run test && npm run build && npm run test:e2e` before you say a change is done, and report failures with their output.

## Architecture rules

- Keep `src/index.ts` (the integration hooks) free of Astro version checks. Version-specific behavior goes in `src/compat/astro<major>.ts` behind one shared interface, selected in `src/compat/index.ts`.
- Use only documented Astro entry points (`astro`, `astro/app`, `astro/env/setup`, `astro/errors`). Never import from `astro/dist/...`.
- Keep Wrangler and the `cf` CLI behind the interfaces in `src/tooling/`. The adapter must never shell out to either CLI during a build.
- Record every experiment result about Astro or Pages behavior in `docs/compat-notes.md`. When an experiment contradicts existing notes, trust the experiment and update the notes.
- Do not add an adapter option without a test that uses it.
- Write user-facing text only in `src/messages.ts` and output it with `log` from `src/log.ts` (Astro's logger). One line of plain ASCII, ending with a period. Never call `logger.*` or `console.*` elsewhere, and do not add a logging library; `src/messages.test.ts` enforces this.
- Keep `src/index.ts` to the hooks, and put build steps in `src/build/` and the dev connection in `src/dev/`. Before adding a helper, check `src/utils/` for one that exists (for example `listFiles` and `createRuntimeLocals`).

## Git workflow

- Never commit directly to `main`. Create a branch from the latest `main` named `<type>/<short-kebab-description>`, for example `feat/routes-json` or `fix/set-cookie-headers`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `<type>(<optional scope>): <summary>`. commitlint enforces them in the `commit-msg` hook and on pull request titles; the allowed types and scopes are listed in [CONTRIBUTING.md](./CONTRIBUTING.md#commit-messages). Never bypass the hooks with `--no-verify`.
- Choose the type with care: `CHANGELOG.md` is generated from commit types by git-cliff at release time, and only `feat`, `fix`, `perf`, `refactor` and `docs` are listed. Never edit `CHANGELOG.md` by hand.
- Keep commits small, one logical change each. When a change contradicts an earlier decision, say so in the commit body.
- The pull request title must also be a Conventional Commit, because pull requests are squash-merged and the title becomes the commit on `main`.
- Never add `Co-Authored-By` or "Generated with" lines to commits or pull requests.
- Do not merge pull requests or enable auto-merge unless the maintainer explicitly allows it. The only standing exception is the `dependabot-auto-merge` workflow, which auto-merges patch and minor Dependabot updates after the required checks pass.
- `release:` commits and `v*` tags are created only by the `release` workflow. Do not create them by hand.

## Safety

- Ask the maintainer before publishing to npm, deploying, creating or changing Cloudflare resources, or touching any token or secret.
- Never write tokens, account IDs, or credentials into files, test fixtures, logs, or commit messages.
- Never commit `.private/`, `CLAUDE.local.md`, or anything under `.claude/`.
- Do not claim support for an Astro version that no fixture or CI job has tested.

## Writing style

- Everything in the repository is in English: code, identifiers, comments, docs, commit messages, and pull request text.
- Do not break a sentence across lines in Markdown or comments. Wrap only at paragraph, list item, heading, or code block boundaries.
- Use half-width punctuation only. Full-width punctuation is not allowed, except `！` and `？`.
- In GitHub alert blocks (`> [!NOTE]` and similar), a blank line inside the block is `>` followed by exactly three spaces.
- The README's first paragraph must state that the package is unofficial.

## Agent skills

There are two separate skill directories. Do not mix them up.

| Directory | Purpose | Who uses it |
| --- | --- | --- |
| `skills/` | Skills shipped to users of the adapter (npm tarball and `npx skills add otnc/astro-adapter-cloudflare-pages`) | Users' agents |
| `.agents/skills/` | Third-party skills for developing this repository, managed by the [skills CLI](https://github.com/vercel-labs/skills) and pinned in `skills-lock.json` | Agents working here |

Development skills to use in this repository:

- `hush`: follow it for every code change (naming over comments, doc comments on exported API). Use `hush-review` or `hush-fix` to audit comments.
- `antislop` (core) with `antislop-code` and `antislop-copywriting`: apply them when writing code comments, docs, the README, and skill text. `antislop-ui`, `antislop-layoutmobile`, and `antislop-human` apply only to UI work, such as a fixture site or a docs page.
- `fix-unnatural-line-breaks`: apply it when writing or reviewing Markdown and comments.
- `token-saver-claude-code`, `token-saver-codex`, `token-saver-opencode`: use the one for your agent when a session nears a usage limit or gets long.

Managing development skills:

- Add one with `npx skills add <owner>/<repo> -s <skill> -a claude-code codex -y`. This keeps the original in `.agents/skills/` and a symlink in `.claude/skills/` (git-ignored). Commit `.agents/skills/` and `skills-lock.json` together.
- Create user-facing skills with `cd skills && npx skills init <name>` (not `skills init skills/<name>`, which writes the path into `name`) and keep the template's sections (`## When to use`, `## Instructions`). Run `npm run check:skills` after changing them. Skills must tell agents to ask before deploying, creating Cloudflare resources or handling tokens.
- Skills listed in `skills-lock.json` are excluded when this repository is used as a skills source, so they are not offered to users. Never add development skills under `skills/`.
- Do not edit files in `.agents/skills/` by hand. Update them through the skills CLI.
- If `.claude/skills/` is missing after a fresh clone, run `npm run skills:link` to recreate the links.
