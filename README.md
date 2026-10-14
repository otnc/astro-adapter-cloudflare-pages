# astro-adapter-cloudflare-pages

> Astro adapter for deploying on-demand rendered sites to Cloudflare Pages (Astro 6, 7 and later)

[![npm](https://img.shields.io/npm/v/astro-adapter-cloudflare-pages)](https://www.npmjs.com/package/astro-adapter-cloudflare-pages)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/astro-adapter-cloudflare-pages/ci.yml?branch=main)](https://github.com/otnc/astro-adapter-cloudflare-pages/actions)
[![GitHub](https://img.shields.io/github/license/otnc/astro-adapter-cloudflare-pages)](https://github.com/otnc/astro-adapter-cloudflare-pages/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/astro-adapter-cloudflare-pages)](https://www.npmjs.com/package/astro-adapter-cloudflare-pages)

This is an **unofficial, community** adapter. It is not affiliated with or endorsed by Astro or Cloudflare. The official [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) adapter dropped Cloudflare Pages support in v13 and targets Cloudflare Workers. If you can move to Workers, use the official adapter instead; Cloudflare recommends Workers for new projects.

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

```sh
npx astro build
npx wrangler pages deploy dist
```

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

## Sessions

When `session.driver` is not set, the adapter stores [Astro sessions](https://docs.astro.build/en/guides/sessions/) in the KV namespace bound as `SESSION` (change it with `sessionKVBindingName`). Add that binding to your Pages project, or set your own `session` config.

## Images

Cloudflare Pages cannot run sharp, which is Astro's default image service. The adapter switches it to the passthrough service, so images are served without optimization. Configure another `image.service` if you need resizing.

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
| `tool` | `"auto"` | `"wrangler"` or `"cf"`. `"auto"` picks `cf` when a `cloudflare.config.*` file exists. |
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
| Middleware | Untested |
| Actions | Untested |
| Server islands | Untested |
| i18n routing | Untested |
| Astro 7 Advanced Routing (`src/fetch.ts`) | Untested |
| Image optimization | Not supported (passthrough only) |
| `cf` CLI | Detected from `cloudflare.config.*`, but it cannot deploy to Pages and has no local runtime API yet; `astro dev` uses Wrangler |

## Known limitations

- `passThroughOnException()` is not available in Pages Functions and throws.
- Prerendering runs in Node.js, so prerendered pages cannot import `cloudflare:*` modules. Read bindings in on-demand pages instead.
- In `astro dev`, pages run in Node.js with emulated bindings. Use `Astro.locals.runtime.env` rather than importing `cloudflare:workers`, which only exists in the deployed Worker.
- Pages limits `_routes.json` to 100 rules. When the generated rules would exceed it, the adapter falls back to sending every request except static assets to the Worker.

## Migrating to Workers

Cloudflare recommends Workers for new projects. To move, switch to the official [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) adapter and follow Cloudflare's [Pages to Workers migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/). The official adapter replaces `Astro.locals.runtime` with `import { env } from "cloudflare:workers"` and `Astro.locals.cfContext`.

## Agent skills

This package includes [agent skills](https://github.com/vercel-labs/skills) that teach coding agents (Claude Code, Codex, Cursor and others) how to set up, migrate to and troubleshoot this adapter:

```sh
npx skills add otnc/astro-adapter-cloudflare-pages
```

They are also shipped in the npm package under `node_modules/astro-adapter-cloudflare-pages/skills/`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details. To report a security problem, see [SECURITY.md](./SECURITY.md).

## License

Distributed under the [MIT License](./LICENSE). Parts of the code are derived from `@astrojs/cloudflare` (MIT).
