# Compatibility notes

Results of experiments about how Astro and Cloudflare Pages behave with this adapter. Record every result here, including negative ones, with the date, the versions used, and the fixture that covers it. When a result contradicts an earlier note, update the note and say so in the commit message.

## Tested versions

The e2e tests (`npm run test:e2e`) install the packed adapter into an isolated project per Astro major, build the fixture, and serve it with `wrangler pages dev`. CI runs them for every pull request.

| Astro | Wrangler | Fixture | Result | Date |
| --- | --- | --- | --- | --- |
| 6.4.8 | 4.151.0 | `basic`, `hybrid` | Pass (`wrangler pages dev` and `astro dev`) | 2026-10-15 |
| 7.3.8 | 4.151.0 | `basic`, `hybrid`, `advanced` | Pass (`wrangler pages dev` and `astro dev`) | 2026-10-15 |

The `hybrid` fixture covers static output with on-demand pages and i18n routing, and the `advanced` fixture covers Advanced Routing with `src/fetch.ts` (Astro 7 only). The `basic` fixture covers middleware, actions, server islands, a prerendered page, an on-demand page, a dynamic route, an API endpoint, a prerendered 404 page, a public file, static and dynamic redirects, `astro:env` secrets, cookies, the client address, `Astro.locals.runtime` and `Astro.locals.cfContext`, and sessions in KV. It is not deployed to a real Pages project by CI; a real deployment is a manual release check.

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
| 6, 7 | `createExports()` is deprecated. | The adapter uses `entrypointResolution: "auto"` and a server entrypoint that default-exports `{ fetch }`. | `basic` |

## Other findings

- Without a `404.html`, Pages answers any unknown path with `index.html` and status 200. The v12 handler fell back to the static files for every unmatched request, so such sites showed the home page instead of a 404, and a custom `src/fetch.ts` never saw the request. The adapter now falls back to the static files only for prerendered routes and `.html` URLs (2026-10-15).

- In `astro dev`, `astro:env` reads `process.env`, not the platform proxy. The adapter copies the variables that `env.schema` declares from the proxy bindings into `process.env`, as v12 did (2026-10-15).
- `astro dev` serves files from `public/` before routes are ready, and the first request to a page can make Vite re-optimize dependencies and drop connections. The e2e harness waits for a page to answer and warms up each route (2026-10-15).
- A dev server spawned from Vitest inherits `NODE_ENV=test` and `VITEST*`, which made Astro 7 `astro dev` stop answering requests. The harness removes them from child processes (2026-10-15).

- The official `@astrojs/cloudflare` v14 still writes `_routes.json` and `_redirects`, and depends on `@astrojs/underscore-redirects`, which this adapter also uses (2026-10-15).
- `@astrojs/underscore-redirects` maps a dynamic redirect such as `/blog/[slug]` to its own prerendered HTML file instead of the destination. The adapter writes only static redirects to `_redirects` and lets the Worker render dynamic ones, which `_routes.json` then includes (2026-10-15).
- Astro's default image service (sharp) gets bundled into the Worker and pulls in Node.js built-ins. The adapter switches it to the passthrough service (2026-10-15).
- `wrangler pages dev` did not read `wrangler.jsonc` or `wrangler.toml` from `test/fixtures/basic` inside this repository, but did read the same file from the isolated e2e project. The e2e tests pass bindings with `--binding` and `--kv` so they do not depend on this (2026-10-15).
