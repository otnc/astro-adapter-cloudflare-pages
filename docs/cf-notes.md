# Notes on the `cf` CLI and life after Wrangler

Cloudflare's [`cf`](https://www.npmjs.com/package/cf) CLI is presented as the next version of Wrangler. This file records what it can and cannot do for Cloudflare Pages, and how the adapter can keep working if Wrangler stops being an option. Checked with `cf@1.0.0-beta.17` (the latest release) and the official docs on 2026-10-15.

## Findings

| Question | Answer |
| --- | --- |
| Can `cf` deploy to Pages? | No. `cf pages deploy` exists only to print an error: for a project Wrangler deployed, "Legacy Pages is not supported in `cf`. Please use `npx wrangler pages deploy` for this project."; otherwise it points to `cf deploy` and "the new version of Pages on Workers", which is Workers with static assets. |
| Does `cf` have other Pages commands? | Yes, as raw API commands generated from Cloudflare's public OpenAPI, for example `cf pages deployments create` (`POST /accounts/{account_id}/pages/projects/{project_name}/deployments`). |
| Can Pages be deployed through the public API alone? | Not completely. Creating a deployment is documented (a `manifest` of file hashes plus `_worker.js` or `_worker.bundle`, `_routes.json`, `_redirects` and `_headers`), but uploading the static files uses endpoints that only Wrangler calls and that are not in the public API or docs (`/pages/projects/{name}/upload-token`, `/pages/assets/check-missing`, `/pages/assets/upload`, `/pages/assets/upsert-hashes`). |
| Which config file does `cf` read? | `cloudflare.config.ts`, written with `defineConfig` from `cf/config` (re-exported from `@cloudflare/config`). The [configuration reference](https://developers.cloudflare.com/cf/projects/config-explorer/) describes Workers only; there is no Pages build output setting. Bindings accept `dev` options for local development. |
| What does `cf deploy --prebuilt` upload? | The Build Output Specification directory `.cloudflare/output/v0/workers/<name>/` (`@cloudflare/build-output-utils`). It describes Workers, not Pages, and its authors mark it as not yet stable. |
| Does `cf` expose a programmatic local runtime? | No. The package exports the CLI entry (`buildCli`, `main`, `runMain`) and the config helpers (`bindings`, `defineConfig`, `defineContainer`, `defineWorker`, `exports`, `triggers`). Nothing replaces Wrangler's `getPlatformProxy()`. |
| Is there a public alternative to `getPlatformProxy()`? | Yes. [Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/) is a documented package; `new Miniflare({ kvNamespaces, d1Databases, r2Buckets, bindings, ... })` and `getBindings()` give Node.js the same binding proxies. Miniflare does not read Wrangler or `cf` config files, so the bindings must be passed in. |
| Is Wrangler itself moving away from Pages? | Partly. Since Wrangler 4.151, `wrangler pages project create` switches to Workers unless `--force` is passed (see [compat-notes.md](./compat-notes.md)). Deploying to an existing Pages project still works. |
| When will Wrangler be retired? | No date. Neither the [`cf` announcement](https://blog.cloudflare.com/cf-cli-local-explorer/) nor the [`cf` docs for Wrangler users](https://developers.cloudflare.com/cf/wrangler/) give a timeline or mention Pages. |

## What the adapter does today

- `cf` is an optional peer dependency (`^1.0.0-beta.17`).
- The `tool` option (`"auto"` by default) picks `cf` when a `cloudflare.config.*` file exists, and the adapter watches that file in `astro dev`.
- `astro dev` uses Wrangler's `getPlatformProxy()` for bindings. Bindings declared only in `cloudflare.config.*` are not available in development, and the adapter warns about it.
- Deployment needs Wrangler (`wrangler pages deploy`) or the Pages Git integration, which builds and deploys in Cloudflare without any CLI on the user's side.

## If Wrangler stops being an option

The build output is plain files, so building never depends on Wrangler. Three things do:

| Need | Plan | Status |
| --- | --- | --- |
| Bindings in `astro dev` | A Miniflare provider in `src/tooling/`. Done: `tool: "miniflare"` takes bindings from `platformProxy.miniflare` and returns `getBindings()`. Reading them from the Wrangler config or from `cloudflare.config.*` is still open (it needs the tool's own loader, which is not stable for `cf`). | Variables, KV, D1 and R2 are available and tested for variables, KV and sessions. |
| Running the build locally (`wrangler pages dev`) | Done: `astro preview` runs the build in Miniflare with an `ASSETS` service binding that serves `dist/`, `_redirects` applied, and bindings from `platformProxy.miniflare`. `_routes.json` and `_headers` are not applied. | Tested on Astro 6 and 7. |
| Deploying to Pages | Prefer the Pages Git integration, which needs no CLI. A built-in uploader is possible but would depend on the undocumented asset upload endpoints above, so it is not planned unless Cloudflare documents them or retires Wrangler without another Pages uploader. | Documented, not built. |
| Moving off Pages | Cloudflare points `cf` users to Workers with static assets. A future `target: "workers"` mode could emit Workers static assets output (and Build Output for `cf deploy`) while keeping `Astro.locals.runtime`, so projects can move without changing code. The official `@astrojs/cloudflare` adapter is the other path. | Idea, to evaluate after 0.1.0. |

## To check again

- Each new `cf` release: Pages support, a programmatic local runtime, and the stability of `cloudflare.config.ts` and the Build Output Specification.
- Cloudflare's docs and changelog for a Wrangler or Pages retirement date.
