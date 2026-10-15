# astro-adapter-cloudflare-pages

> Astro adapter for deploying on-demand rendered sites to Cloudflare Pages or Miniflare (Astro 6, 7 or later)

[![npm](https://img.shields.io/npm/v/astro-adapter-cloudflare-pages)](https://www.npmjs.com/package/astro-adapter-cloudflare-pages)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/astro-adapter-cloudflare-pages/ci.yml?branch=main)](https://github.com/otnc/astro-adapter-cloudflare-pages/actions)
[![GitHub](https://img.shields.io/github/license/otnc/astro-adapter-cloudflare-pages)](https://github.com/otnc/astro-adapter-cloudflare-pages/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/astro-adapter-cloudflare-pages)](https://www.npmjs.com/package/astro-adapter-cloudflare-pages)

This is an **unofficial, community** adapter. It is not affiliated with or endorsed by Astro or Cloudflare. The official [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) adapter dropped Cloudflare Pages support in v13 and targets Cloudflare Workers.

> [!NOTE]
> Cloudflare recommends Workers instead of Pages for new projects. To move, use the official adapter and follow Cloudflare's [Pages to Workers migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).

> [!WARNING]
> This is an early release (0.x). Options and behavior may change in minor versions. See [docs/compat-notes.md](./docs/compat-notes.md) for exactly what has been tested.

## Supported versions

| Astro | Status |
| --- | --- |
| 7 | Tested (7.3.8) |
| 6 | Tested (6.4.8) |
| 5 | Not supported. Use `@astrojs/cloudflare` v12. |
| 8 and later | Not tested yet. The build fails with an explanation unless you opt in with `unsafe.allowUntestedAstro`. |

Node.js 22.12.0 or later is required (the same as Astro 6 and 7).

## Install

```sh
npm install astro-adapter-cloudflare-pages
npm install --save-dev wrangler
```

Wrangler is optional for building, but it provides Cloudflare bindings in `astro dev` and deploys the site.

## Configure

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import cloudflarePages from "astro-adapter-cloudflare-pages";

export default defineConfig({
  output: "server",
  adapter: cloudflarePages(),
});
```

A minimal Wrangler config for a Pages project:

```jsonc
// wrangler.jsonc
{
  "name": "my-site",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-10-01",
  // Only needed if you use Astro sessions (see below).
  "kv_namespaces": [{ "binding": "SESSION", "id": "<your KV namespace id>" }],
}
```

## Deploy

Create the Pages project once, then deploy the build:

```sh
npx wrangler pages project create my-site --production-branch main --force
npx astro build
npx wrangler pages deploy dist
```

> [!WARNING]
> Since Wrangler 4.151, `wrangler pages project create` without `--force` does not create a Pages project. It switches to Cloudflare Workers instead and rewrites the project in the current directory (it installs `@astrojs/cloudflare`, edits `package.json` and `tsconfig.json`, and creates a Workers `wrangler.jsonc`). Keep `--force` to create a classic Pages project, or create the project in the Cloudflare dashboard. Deploying to an existing Pages project with `wrangler pages deploy` is not affected.

You can also connect the repository to Cloudflare Pages with the build command `npx astro build` and the output directory `dist`. The build output is plain files (`dist/_worker.js/`, `_routes.json`, `_redirects` and static assets), so any tool that uploads a Pages directory works.

The [`cf` CLI](https://www.npmjs.com/package/cf), which is expected to replace Wrangler, does not deploy to Cloudflare Pages: its `cf pages deploy` command only points back to `wrangler pages deploy` or to Workers. Use Wrangler or the Pages Git integration. See [docs/cf-notes.md](./docs/cf-notes.md) for the details and the plan if Wrangler goes away.

## Use Cloudflare APIs

On-demand rendered pages, endpoints and middleware can read the Pages runtime from `Astro.locals`:

```astro
---
const { env, cf, ctx } = Astro.locals.runtime;
const value = await env.MY_KV.get("key");
ctx.waitUntil(logVisit(cf?.country));
---
```

| Property | Content |
| --- | --- |
| `Astro.locals.runtime.env` | Bindings and variables (KV, D1, R2, secrets and so on) |
| `Astro.locals.runtime.cf` | The request's `cf` object (country, colo and so on) |
| `Astro.locals.runtime.caches` | The Cache API |
| `Astro.locals.runtime.ctx` | `waitUntil()`. `passThroughOnException()` throws, because Pages does not support it. |
| `Astro.locals.cfContext` | The raw execution context, under the name that `@astrojs/cloudflare` v13 and later use |

`Astro.locals.runtime` has the same shape as in `@astrojs/cloudflare` v12, so code written for v12 keeps working. To type your bindings, add this to `src/env.d.ts`:

```ts
type Runtime = import("astro-adapter-cloudflare-pages").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
```

`Env` can come from `wrangler types`, or you can declare it yourself.

[`astro:env`](https://docs.astro.build/en/guides/environment-variables/) server variables and secrets are read from the same bindings, both in production and in `astro dev`.

## Without Wrangler

Set `tool: "miniflare"` to emulate bindings in `astro dev` with [Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/) directly, without Wrangler. Miniflare itself reads no config files, so the adapter reads `wrangler.jsonc`, `wrangler.json` or `wrangler.toml` for it (or the file at `platformProxy.configPath`, with `platformProxy.environment`): `vars`, `kv_namespaces`, `d1_databases`, `r2_buckets`, `compatibility_date` and `compatibility_flags`. Only the binding names are used, so every namespace, database and bucket is local. Anything in `platformProxy.miniflare` is added to that and wins on conflicts:

```js
// astro.config.mjs
export default defineConfig({
  output: "server",
  adapter: cloudflarePages({
    tool: "miniflare",
    platformProxy: {
      miniflare: {
        bindings: { GREETING: "hello" },
        kvNamespaces: ["SESSION"],
      },
    },
  }),
});
```

The same bindings are used by `astro preview`. Install `miniflare` (`npm install --save-dev miniflare`) instead of `wrangler`; Miniflare 4 and 5 both work. Data lives in memory unless you set `persist` to a directory.

### Previewing the build

`astro preview` serves the build in Miniflare, the runtime Pages uses, with the static files behind an `ASSETS` binding, the static rules of `_redirects` applied first, and `cf-connecting-ip` set from the connection. It needs `miniflare` and reads the bindings from `platformProxy.miniflare`, whichever `tool` you use. Without that option the preview starts without bindings and logs a warning; `wrangler pages dev dist` is the alternative if you keep your bindings in a Wrangler config. Set `platformProxy.miniflare.compatibilityDate` and `compatibilityFlags` (for example `["nodejs_compat"]`) if your build needs them.

The preview applies `_headers` to the static files it serves, as Pages does, but not `_routes.json`: it always runs the Worker for requests that have no static file.

### Running the build in Miniflare

The build output (`dist/_worker.js/`) is a standard module Worker, so it also runs in your own workerd or Miniflare host, for example in tests or on a platform that is not Cloudflare. It is checked with Astro 6 and 7 in Miniflare 4, without Wrangler. What the host has to provide:

- **Modules**: declare every file in `_worker.js/` (`modules: [{ type: "ESModule", path }]` with `modulesRoot`). Miniflare cannot follow the dynamic imports in the bundle by itself.
- **`ASSETS`**: a service binding that returns the static files in `dist/` (`/about` from `about.html`, `/` from `index.html`) and a 404 for unknown paths. The adapter does not read `_routes.json`, which only matters on Pages.
- **Bindings**: your variables, KV namespaces and so on, as Miniflare options.
- **`cf-connecting-ip`**: `Astro.clientAddress` is read from this header, which Cloudflare sets on every request. Without it, pages that use `Astro.clientAddress` fail with `ClientAddressNotAvailable`, so a proxy in front of Miniflare has to set it.
- **Compatibility date**: not newer than the workerd in your Miniflare release supports.

Deploying a site to Cloudflare Pages still needs Wrangler or the Pages Git integration.

## Static headers

Astro computes headers for prerendered pages, for example the Content-Security-Policy that [`security.csp`](https://docs.astro.build/en/reference/configuration-reference/#securitycsp) generates. With `staticHeaders` (on by default) the adapter writes them to `_headers` in the build output, so Pages sends them with the static files instead of Astro putting the policy in a `<meta>` tag. Rules from `public/_headers` are kept, and the generated rules follow them under a comment line. Headers that describe the body (`content-type`, `content-length`, `content-encoding`) are left out, and with the `directory` build format the paths end in a slash, as Pages serves them.

Pages accepts at most 100 rules in `_headers` and ignores the whole file above that, so the adapter warns when a build produces more. Set `staticHeaders: false` to go back to the `<meta>` tag.

## WebAssembly and other modules

Like `@astrojs/cloudflare` v12, the adapter lets pages and endpoints import `.wasm`, `.bin` and `.txt` files.

```ts
import add from "../assets/add.wasm?module"; // WebAssembly.Module
import blob from "../assets/blob.bin"; // ArrayBuffer
import note from "../assets/note.txt"; // string

const { exports } = new WebAssembly.Instance(add);
```

In the Worker build a `.wasm` file becomes a file next to the bundle in `dist/_worker.js/` that the bundle imports, which is the only way to load WebAssembly on Cloudflare, and Pages uploads it as a module. `.bin` and `.txt` files are inlined. Prerendering and `astro dev` run in Node.js, where the bytes are inlined for all three. Set `cloudflareModules: false` to turn the feature off.

## Custom Worker entry

Set `workerEntryPoint` to wrap the adapter's handler, for example to answer some paths yourself or to add headers to every response:

```ts
// src/worker.ts
import handler from "astro-adapter-cloudflare-pages/handler";

export default {
  async fetch(request: Request, env: unknown, context: unknown) {
    const response = await handler.fetch(request, env, context);
    response.headers.set("x-served-by", "my-worker");
    return response;
  },
};
```

```js
// astro.config.mjs
cloudflarePages({ workerEntryPoint: "./src/worker.ts" });
```

A Pages Worker runs `fetch` only, so `scheduled`, `queue` and Durable Object exports are not supported.

## Sessions

When `session.driver` is not set, the adapter stores [Astro sessions](https://docs.astro.build/en/guides/sessions/) in the KV namespace bound as `SESSION` (change it with `sessionKVBindingName`). Add that binding to your Pages project, or set your own `session` config.

## Images

Cloudflare Pages cannot run sharp, Astro's default image service. Choose how images are handled with the `imageService` option:

| Value | Prerendered pages | On-demand pages |
| --- | --- | --- |
| `"compile"` (default) | Optimized with sharp at build time | Served unchanged |
| `"passthrough"` | Served unchanged | Served unchanged |
| `"cloudflare"` | Resized by [Cloudflare Images transformations](https://developers.cloudflare.com/images/transform-images/) (`/cdn-cgi/image/...`), which must be enabled on your zone | Same |
| `"custom"` | Your `image.service` | Your `image.service` |

If you configure an `image.service` other than sharp, the adapter keeps it. `astro dev` always resizes with sharp, except with `"passthrough"` and `"custom"`.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `routes.extend.include` | `[]` | Extra `{ pattern }` rules added to the generated `_routes.json` include list |
| `routes.extend.exclude` | `[]` | Extra `{ pattern }` rules added to the exclude list |
| `platformProxy.enabled` | `true` | Emulate bindings in `astro dev` with Wrangler's local runtime |
| `platformProxy.configPath` | Auto | Path to the Wrangler config file |
| `platformProxy.environment` | None | Named environment in the Wrangler config |
| `platformProxy.persist` | Wrangler's default | Where to keep local binding data, or `false` |
| `sessionKVBindingName` | `"SESSION"` | KV binding for the default session driver |
| `imageService` | `"compile"` | `"compile"`, `"passthrough"`, `"cloudflare"` or `"custom"` (see [Images](#images)) |
| `tool` | `"auto"` | `"wrangler"`, `"cf"` or `"miniflare"`. `"auto"` picks `cf` when a `cloudflare.config.*` file exists, and Wrangler otherwise. `"miniflare"` is never picked automatically. |
| `platformProxy.miniflare` | From the Wrangler config | Bindings, added to those of `wrangler.jsonc`, `wrangler.json` or `wrangler.toml`, for `tool: "miniflare"` and for `astro preview`: `bindings` (variables and secrets), `kvNamespaces`, `d1Databases`, `r2Buckets`, `persist`, and for the preview `compatibilityDate` and `compatibilityFlags` (see [Without Wrangler](#without-wrangler)) |
| `target` | `"pages"` | `"pages"` or `"workers"` (see [Workers output](#workers-output)) |
| `workerEntryPoint` | None | Path to your own Worker entry (see [Custom Worker entry](#custom-worker-entry)) |
| `staticHeaders` | `true` | Write the headers Astro computes for static pages to `_headers` (see [Static headers](#static-headers)) |
| `cloudflareModules` | `true` | Import `.wasm`, `.bin` and `.txt` files (see [WebAssembly and other modules](#webassembly-and-other-modules)) |
| `unsafe.allowUntestedAstro` | `false` | Build on an untested Astro major with a warning instead of an error |

If `public/_routes.json` exists, the adapter keeps it and does not generate one.

## Features

| Feature | Status |
| --- | --- |
| On-demand rendered pages and endpoints | Tested |
| Prerendered pages and a prerendered 404 page | Tested |
| Static and dynamic redirects | Tested |
| `astro:env` secrets | Tested |
| Sessions in KV | Tested |
| Cookies and `Astro.clientAddress` | Tested |
| `astro dev` with bindings (Wrangler) | Tested |
| Static output with on-demand pages (`prerender = false`) | Tested |
| Middleware | Tested |
| Actions | Tested |
| Server islands | Tested |
| i18n routing | Tested |
| Astro 7 Advanced Routing (`src/fetch.ts`) | Tested |
| Static headers (`_headers` from `security.csp`) | Tested |
| `astro preview` (Miniflare, bindings from `platformProxy.miniflare`) | Tested |
| Custom Worker entry (`workerEntryPoint`) | Tested |
| Workers output (`target: "workers"`, `wrangler dev` and `astro preview`) | Tested |
| Bindings from `wrangler.jsonc` and `wrangler.toml` for Miniflare (`astro dev` and `astro preview`) | Tested |
| Miniflare 4 and 5 (`astro dev` with `tool: "miniflare"`, `astro preview`) | Tested |
| `.wasm`, `.bin` and `.txt` imports (`cloudflareModules`) | Tested (`wrangler pages dev`, `astro preview`, prerendering) |
| Astro 6 experimental Advanced Routing (`src/app.ts`) | Untested |
| Image optimization (`compile` and `cloudflare` image services) | Tested |
| `astro dev` without Wrangler (`tool: "miniflare"`: variables, KV, D1, R2) | Tested (variables, KV and sessions) |
| `cf` CLI | Detected from `cloudflare.config.*`, but it cannot deploy to Pages and has no local runtime API yet; `astro dev` uses Wrangler |

## Known limitations

- `passThroughOnException()` is not available in Pages Functions and throws.
- Prerendering runs in Node.js, so prerendered pages cannot import `cloudflare:*` modules. Read bindings in on-demand pages instead.
- In `astro dev`, pages run in Node.js with emulated bindings. Use `Astro.locals.runtime.env` rather than importing `cloudflare:workers`, which only exists in the deployed Worker.
- Pages limits `_routes.json` to 100 rules. When the generated rules would exceed it, the adapter falls back to sending every request except static assets to the Worker.

## Workers output

With `target: "workers"` the build writes the same Worker for [Workers with static assets](https://developers.cloudflare.com/workers/static-assets/): the Worker is `dist/server/index.js`, the static files (with `_headers` and `_redirects`) are in `dist/client/`, and no `_routes.json` is written. Point your Wrangler config at them and name the assets binding `ASSETS`:

```jsonc
// wrangler.jsonc
{
  "name": "my-site",
  "main": "dist/server/index.js",
  "compatibility_date": "2026-08-01",
  "assets": { "directory": "dist/client", "binding": "ASSETS" },
}
```

Deploy with `wrangler deploy`. `astro dev`, `astro preview` and the other options work as on Pages.

## Migrating to Workers

The official adapter replaces `Astro.locals.runtime` with `import { env } from "cloudflare:workers"` and `Astro.locals.cfContext`.

## Agent skills

This package includes [agent skills](https://github.com/vercel-labs/skills) that teach coding agents (Claude Code, Codex, Cursor and others) how to set up, migrate to and troubleshoot this adapter:

```sh
npx skills add otnc/astro-adapter-cloudflare-pages
```

They are also shipped in the npm package under `node_modules/astro-adapter-cloudflare-pages/skills/`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details. To report a security problem, see [SECURITY.md](./SECURITY.md).

## License

Distributed under the [MIT License](./LICENSE). Parts of the code are derived from `@astrojs/cloudflare` (MIT); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
