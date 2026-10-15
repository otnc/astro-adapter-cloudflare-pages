# Compatibility notes

Results of experiments about how Astro and Cloudflare Pages behave with this adapter. Record every result here, including negative ones, with the date, the versions used, and the fixture that covers it. When a result contradicts an earlier note, update the note and say so in the commit message.

## Tested versions

The e2e tests (`npm run test:e2e`) install the packed adapter into an isolated project per Astro major, build the fixture, and serve it with `wrangler pages dev`. CI runs them for every pull request.

| Astro | Wrangler | Fixture | Result | Date |
| --- | --- | --- | --- | --- |
| 6.4.8 | 4.151.0 | `basic`, `hybrid`, `images`, `images-cloudflare`, `headers` | Pass (`wrangler pages dev` and `astro dev`) | 2026-10-15 |
| 7.3.8 | 4.151.0 | `basic`, `hybrid`, `advanced`, `images`, `images-cloudflare`, `headers` | Pass (`wrangler pages dev` and `astro dev`) | 2026-10-15 |

The `hybrid` fixture covers static output with on-demand pages and i18n routing, and the `advanced` fixture covers Advanced Routing with `src/fetch.ts` (Astro 7 only). The `basic` fixture covers middleware, actions, server islands, a prerendered page, an on-demand page, a dynamic route, an API endpoint, a prerendered 404 page, a public file, static and dynamic redirects, `astro:env` secrets, cookies, the client address, `Astro.locals.runtime` and `Astro.locals.cfContext`, and sessions in KV. It is not deployed to a real Pages project by CI; a real deployment is a manual release check.

| Real deployment | Astro | Wrangler | Result | Date |
| --- | --- | --- | --- | --- |
| `basic` on a throwaway Pages project (`*.pages.dev`) with a KV namespace and a `GREETING` variable | 6.4.8, 7.3.8 | 4.151.0 | Pass: 16 checks each (prerendered page, public file, on-demand page with vars, cookies, client address, dynamic route, endpoint, `astro:env`, 404, static and dynamic redirects, sessions in KV, middleware, actions, server islands) | 2026-10-15 |

| Astro | Miniflare | Fixture | Result | Date |
| --- | --- | --- | --- | --- |
| 6.4.8, 7.3.8 | 4.20260730.0 | `miniflare` (`astro dev` with `tool: "miniflare"`, no Wrangler installed) | Pass: variables, KV, `cf`, `astro:env`, sessions | 2026-10-15 |
| 6.4.8, 7.3.8 | 4.20260730.0 | `basic` build output run in Miniflare with an `ASSETS` service binding and no Wrangler | Pass: prerendered and on-demand pages, cookies, client address, middleware, actions, server islands, `astro:env`, sessions, 404 | 2026-10-15 |

| Astro | Miniflare | Fixture | Result | Date |
| --- | --- | --- | --- | --- |
| 6.4.8, 7.3.8 | 4.20260730.0 | `preview` (`astro preview`, no Wrangler installed) | Pass: prerendered pages, 404, on-demand pages with bindings, client address, static redirects, request bodies, sessions in KV | 2026-10-15 |

## Open questions

| # | Question | Status |
| --- | --- | --- |
| 1 | Do Astro 6 and 7 still honor `build.server` and `build.serverEntry` the way `@astrojs/cloudflare` v12 relied on? | Answered: yes. The server bundle lands in `dist/_worker.js/index.js` on both majors (2026-10-15). |
| 2 | How does the Astro 7 Advanced Routing entrypoint (`src/fetch.ts`) combine with a Pages `_worker.js` bundle? | Answered: `createApp()` wires it in, and it works once unknown paths reach Astro (see below). Astro 6.4 has it only as `experimental.advancedRouting` with `src/app.ts`, which is untested (2026-10-15). |
| 3 | Does Pages accept the bundle that Astro 6 and 7 produce (module format, size, `cloudflare:*` imports, Node.js compatibility flags)? | Answered for `wrangler pages dev`: yes, as one ES module of about 650 KB for the basic fixture, without `nodejs_compat`. Confirm on a real deployment before each release. |
| 4 | How can prerendering run in workerd without the official adapter, or should it fall back to Node.js prerendering? | Answered: prerendering uses Astro's default Node.js prerenderer. Prerendered pages therefore cannot import `cloudflare:*` modules. |
| 5 | Can the `cf` CLI deploy to Pages, which config file does it read, and does it have a programmatic local runtime API? | Answered for 1.0.0-beta.17: no Pages deployment, `cloudflare.config.ts` describes Workers only, and no local runtime API. See [cf-notes.md](./cf-notes.md) (2026-10-15). |

## Adapter API differences by Astro version

| Astro | Difference | Workaround | Fixture |
| --- | --- | --- | --- |
| 6 | `astro:env` validates secrets while server modules load, before the first request. Setting `getEnv` per request fails with `EnvInvalidVariables`. | The server entrypoint calls `setGetEnv` at module scope with `env` from `cloudflare:workers`. | `basic` (`/env`) |
| 6 | Server islands are emitted as separate chunks that only re-export from `../index.js`, and the entry exports internal bindings for them. Wrangler cannot resolve the chunk when it re-bundles `_worker.js/`, and workerd rejects the extra named exports as handlers. | The server build disables code splitting (`compat.bundleServerAsOneModule`), and `astro:build:done` folds such re-export-only chunks back into the entry and drops the extra exports. | `basic` (`/island`) |
| 6 | Astro rebuilds the `prerender` and `ssr` environment configs from scratch, so options passed through `updateConfig` for those environments are lost. | The adapter changes them in `astro:build:setup`, which receives the final config. | `basic`, `images-cloudflare` |
| 6, 7 | `createExports()` is deprecated. | The adapter uses `entrypointResolution: "auto"` and a server entrypoint that default-exports `{ fetch }`. | `basic` |

## Other findings

- `adapterFeatures.staticHeaders` makes Astro 6 and 7 hand the headers of prerendered pages to the `astro:build:generated` hook (`routeToHeaders`) instead of writing the Content-Security-Policy into a `<meta>` tag; `security.csp: true` is the setting on both majors. The map also contains `content-type`, which the adapter does not copy to `_headers`. Pages redirects `/about` to `/about/` for `about/index.html`, so a rule for `/about` never matches the page that is served (2026-10-15).

- Astro loads the preview entrypoint with `require.resolve()` on a string, so `previewEntrypoint` must be a package specifier (`astro-adapter-cloudflare-pages/preview`); a `file:` URL fails. The entrypoint runs in the same process after `astro:config:done`, so the integration hands it the `platformProxy.miniflare` option through a process-wide slot. Miniflare's `dispatchFetch()` takes a URL and request options, not a `Request` (2026-10-15).

- Miniflare cannot follow the dynamic import specifiers in the Worker bundle (`ERR_MODULE_DYNAMIC_SPEC`), so a host has to declare every file of `_worker.js/` as a module. `Astro.clientAddress` is read from `cf-connecting-ip`, which only Cloudflare sets, so a host without Cloudflare's edge must set it, or pages using `Astro.clientAddress` fail with `ClientAddressNotAvailable` (2026-10-15).

- Miniflare 4.20260730 rejects a compatibility date newer than its bundled workerd supports ("2026-08-06"). The idle Worker that the Miniflare provider starts uses `2025-01-01`, which every release accepts (2026-10-15).

- Wrangler 4.151 `wrangler pages project create` delegates to "the latest version of Cloudflare Pages, now part of Cloudflare Workers" unless `--force` is passed: it ran autoconfiguration on the current directory (`astro add cloudflare`, `package.json` and `tsconfig.json` edits, a Workers `wrangler.jsonc`) and then failed. With `--force` it creates a classic Pages project, and `wrangler pages deploy` to that project works as before (2026-10-15).

- Prerendering runs in a separate Vite environment (`prerender`) in Node.js, and it loads packages from `node_modules` without bundling unless they are listed in `resolve.noExternal`. The adapter bundles itself there, so its image service gets `import.meta.env.BASE_URL`. Swapping sharp for the no-op service only in the `ssr` environment lets prerendered pages keep sharp optimization (`imageService: "compile"`, as v12 did) (2026-10-15).

- Without a `404.html`, Pages answers any unknown path with `index.html` and status 200. The v12 handler fell back to the static files for every unmatched request, so such sites showed the home page instead of a 404, and a custom `src/fetch.ts` never saw the request. The adapter now falls back to the static files only for prerendered routes and `.html` URLs (2026-10-15).

- In `astro dev`, `astro:env` reads `process.env`, not the platform proxy. The adapter copies the variables that `env.schema` declares from the proxy bindings into `process.env`, as v12 did (2026-10-15).
- `astro dev` serves files from `public/` before routes are ready, and the first request to a page can make Vite re-optimize dependencies and drop connections. The e2e harness waits for a page to answer and warms up each route (2026-10-15).
- A dev server spawned from Vitest inherits `NODE_ENV=test` and `VITEST*`, which made Astro 7 `astro dev` stop answering requests. The harness removes them from child processes (2026-10-15).

- The official `@astrojs/cloudflare` v14 still writes `_routes.json` and `_redirects`, and depends on `@astrojs/underscore-redirects`, which this adapter also uses (2026-10-15).
- `@astrojs/underscore-redirects` maps a dynamic redirect such as `/blog/[slug]` to its own prerendered HTML file instead of the destination. The adapter writes only static redirects to `_redirects` and lets the Worker render dynamic ones, which `_routes.json` then includes (2026-10-15).
- Astro's default image service (sharp) gets bundled into the Worker and pulls in Node.js built-ins. The adapter switches it to the passthrough service (2026-10-15).
- `wrangler pages dev` did not read `wrangler.jsonc` or `wrangler.toml` from `test/fixtures/basic` inside this repository, but did read the same file from the isolated e2e project. The e2e tests pass bindings with `--binding` and `--kv` so they do not depend on this (2026-10-15).
- `.wasm` imports must be emitted as files next to the Worker bundle (`dist/_worker.js/<name>.<hash>.wasm`) and imported from there: workerd refuses to compile WebAssembly from bytes, and Pages uploads every file under `_worker.js/` as a module. Rolldown (Vite 8, Astro 7) and Rollup (Vite 7, Astro 6) both accept an `emitFile` asset plus an external marker import that `renderChunk` rewrites to a relative path (2026-10-15).
- Vite 8 wraps files ending in `.txt` as text modules even when a `pre` plugin returns JavaScript for them, so the plugin loads every module file under a virtual id (`\0…module.js?file=…`) and returns `moduleType: "js"` (2026-10-15).
- `astro preview` runs the Worker in Miniflare, which needs `.wasm` files listed as `CompiledWasm` modules and the entry `index.js` listed first (2026-10-15).
- `wrangler` 4.151 installs Miniflare `5.20261012.0-beta`, which rejects the options this adapter passes to `new Miniflare()` (`modules`, `modulesRoot`, `serviceBindings`). The adapter declares `miniflare ^4.0.0` as an optional peer, so a project that wants `astro preview` must install Miniflare 4 itself (2026-10-15).
