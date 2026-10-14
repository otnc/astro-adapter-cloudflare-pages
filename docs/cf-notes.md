# Notes on the `cf` CLI

Cloudflare's [`cf`](https://www.npmjs.com/package/cf) CLI is expected to replace Wrangler. This file records what it can and cannot do for Pages, so the adapter's support stays honest. Checked with `cf@1.0.0-beta.17` on 2026-10-15.

## Findings

| Question | Answer |
| --- | --- |
| Can `cf` deploy to Pages? | It has `cf pages deploy [directory]` plus project, deployment and domain commands. An actual deployment has not been tried yet. |
| Which config file does it read? | `cloudflare.config.ts`, built with `defineConfig` from `cf/config` (re-exported from `@cloudflare/config`). The public types describe Workers only; there is no Pages build output setting. |
| Does it expose a programmatic local runtime? | No. The package exports only the CLI entry (`buildCli`, `main`, `runMain`) and the config helpers (`bindings`, `defineConfig`, `defineContainer`, `defineWorker`, `exports`, `triggers`). Nothing replaces Wrangler's `getPlatformProxy()`. |
| Is the config format stable? | No. `@cloudflare/config` and `@cloudflare/build-output-utils` are marked as not yet stable by their authors. |

## What the adapter does today

- `cf` is an optional peer dependency (`^1.0.0-beta.17`).
- The `tool` option (`"auto"` by default) picks `cf` when a `cloudflare.config.*` file exists. The adapter watches that file in `astro dev`.
- The build output (`_worker.js`, `_routes.json`, `_redirects`, static files) does not depend on the tool, so any tool that uploads a Pages directory can deploy it.
- `astro dev` still uses Wrangler's `getPlatformProxy()` for bindings, because `cf` has no local runtime API. Bindings declared only in `cloudflare.config.*` are not available in development, and the adapter warns about it.

## To check again before claiming more

- Deploy the `basic` fixture with `cf pages deploy dist` to a throwaway project (needs the maintainer's account).
- Watch for a programmatic local runtime in `cf`, then add a provider under `src/tooling/` and a `tool` axis to the CI matrix.
- Watch whether `cloudflare.config.ts` gains Pages settings, and read bindings from it through `cf/config` instead of parsing it by hand.
