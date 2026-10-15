---
name: astro-cloudflare-pages-migrate
description: Migrate an Astro site on Cloudflare Pages from the official @astrojs/cloudflare v12 adapter (Astro 5) to the unofficial astro-adapter-cloudflare-pages adapter while upgrading to Astro 6 or 7, or decide to move to Cloudflare Workers instead. Use when an Astro upgrade breaks a Pages deployment, when @astrojs/cloudflare v13 or later no longer produces Pages output, or when the user asks how to stay on Cloudflare Pages with a newer Astro.
---

# astro-cloudflare-pages-migrate

Move a Cloudflare Pages site from `@astrojs/cloudflare` v12 to `astro-adapter-cloudflare-pages` while upgrading Astro to 6 or 7, after asking whether the user wants to stay on Pages or move to Workers.

## When to use

- The project uses `@astrojs/cloudflare` v12 (Astro 5) and deploys to Cloudflare Pages.
- An upgrade to Astro 6 or 7, or to `@astrojs/cloudflare` v13 or later, broke the Pages deployment, because those versions target Workers only.
- Not for projects without an adapter: use `astro-cloudflare-pages-setup` instead.

## Instructions

1. Ask which path the user wants, and explain the trade-off in two sentences:
   - **Move to Workers**: upgrade Astro, keep `@astrojs/cloudflare` v13 or later, and follow https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/. Stop using this skill.
   - **Stay on Pages**: continue with the steps below.
2. Upgrade Astro to 6 or 7 with its upgrade guide, without mixing in unrelated changes.
3. Replace the adapter with the project's package manager:

   ```sh
   npm uninstall @astrojs/cloudflare
   npm install astro-adapter-cloudflare-pages
   npm install --save-dev wrangler
   ```

4. In `astro.config.*`, replace `import cloudflare from "@astrojs/cloudflare"` with `import cloudflarePages from "astro-adapter-cloudflare-pages"`, and `cloudflare(...)` with `cloudflarePages(...)`.
5. Map the options:

   | v12 option | This adapter |
   | --- | --- |
   | `routes.extend` | Same shape |
   | `platformProxy` | `enabled`, `configPath`, `environment`, `persist` are supported |
   | `sessionKVBindingName` | Same |
   | `imageService` | Same values: `"compile"` (default), `"passthrough"`, `"cloudflare"`, `"custom"` |
   | `cloudflareModules` | Same: `.wasm`, `.bin` and `.txt` imports work by default; keep `false` only if the v12 config set it |
   | `workerEntryPoint` | Same path option. The entry imports `handle` from the v12 handler; rewrite it to default-export `{ fetch }` and call `handler.fetch(request, env, context)` from `astro-adapter-cloudflare-pages/handler`. Durable Object exports, `scheduled` and `queue` do not work on Pages |

6. Keep code that uses `Astro.locals.runtime`: `env`, `cf`, `caches` and `ctx` have the same shape as in v12, and `Astro.locals.cfContext` is also available.
7. Keep `public/_routes.json` and `public/_redirects` if they exist. The adapter keeps an existing `_routes.json` and appends Astro's static redirects to `_redirects`.
8. Change the type in `src/env.d.ts` to `import("astro-adapter-cloudflare-pages").Runtime<Env>`.
9. Move code that imports `cloudflare:*` out of prerendered pages: prerendering runs in Node.js. Keep the v12 `imageService` value; the default is `"compile"` in both.
10. Verify with `npx astro build` and `npx wrangler pages dev dist`, comparing a dynamic page, a static page, a redirect and the 404 page with the current deployment.
11. Ask the user before deploying, and before creating or changing any Cloudflare resource.
