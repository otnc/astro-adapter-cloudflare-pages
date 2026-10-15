---
name: astro-cloudflare-pages-setup
description: Set up the unofficial astro-adapter-cloudflare-pages adapter so an Astro 6 or 7 site with on-demand rendering deploys to Cloudflare Pages (advanced mode, _worker.js). Use when the user wants Astro SSR, server output or hybrid rendering on Cloudflare Pages, mentions "Cloudflare Pages" with Astro 6 or Astro 7, wrangler pages deploy, or pages_build_output_dir. Do not use for Cloudflare Workers projects; point those to the official @astrojs/cloudflare adapter.
---

# astro-cloudflare-pages-setup

Install and configure `astro-adapter-cloudflare-pages`, an unofficial, community-maintained adapter, so an Astro 6 or 7 project builds for Cloudflare Pages and can be checked locally before the user deploys it.

## When to use

- The user wants on-demand rendering (`output: "server"`, or pages with `export const prerender = false`) on Cloudflare Pages with Astro 6 or 7.
- The project has no Astro adapter yet, or uses one for another host.
- Not for Cloudflare Workers projects: those use the official `@astrojs/cloudflare` adapter. Not for projects that already use `@astrojs/cloudflare` on Pages: use `astro-cloudflare-pages-migrate` instead.

## Instructions

1. Tell the user once that the adapter is unofficial.
2. Check the versions in `package.json` and the lockfile. Astro must be 6.x or 7.x: for Astro 5, stop and recommend `@astrojs/cloudflare` v12; for Astro 8 or later, warn that the adapter has not been tested with it. Node.js must be 22.12.0 or later.
3. Install the adapter, and Wrangler for local bindings and deploys, with the project's package manager:

   ```sh
   npm install astro-adapter-cloudflare-pages
   npm install --save-dev wrangler
   ```

4. Add the adapter to `astro.config.mjs` (or `.ts`). Keep `output: "static"` instead if only a few pages render on demand.

   ```js
   import cloudflarePages from "astro-adapter-cloudflare-pages";

   export default defineConfig({
     output: "server",
     adapter: cloudflarePages(),
   });
   ```

5. Create or update `wrangler.jsonc` with `name`, `pages_build_output_dir: "./dist"` and a `compatibility_date`, plus the bindings the site uses (KV, D1, R2, variables). If the site uses Astro sessions and sets no `session.driver`, add a KV namespace bound as `SESSION`.
6. Type the runtime in `src/env.d.ts`, and suggest `npx wrangler types` to generate `Env`:

   ```ts
   type Runtime = import("astro-adapter-cloudflare-pages").Runtime<Env>;
   declare namespace App {
     interface Locals extends Runtime {}
   }
   ```

7. Read bindings in on-demand code through `Astro.locals.runtime.env`. Do not import `cloudflare:workers` in pages: it is unavailable in `astro dev` and during prerendering.
8. Verify locally with `npx astro build`, then `npx wrangler pages dev dist`, and request one on-demand page and one static page.
9. Ask the user before deploying (`npx wrangler pages deploy dist`), before creating a Pages project or a KV namespace, and before using any API token. Never write tokens or account IDs into files. Create a new Pages project with `npx wrangler pages project create <name> --production-branch main --force`: since Wrangler 4.151, leaving out `--force` switches to Workers and rewrites the project in the current directory (it adds `@astrojs/cloudflare` and edits `package.json`). If that happened, revert those changes with git.
10. If Wrangler is not an option, `tool: "miniflare"` runs `astro dev` with Miniflare instead (`npm install --save-dev miniflare`), with bindings in `platformProxy.miniflare`; see the README section "Without Wrangler". The build output also runs in Miniflare, which is useful for tests.
11. If the user asks for the `cf` CLI, explain that `cf` does not deploy to Cloudflare Pages (its `cf pages deploy` only refers to Wrangler or to Workers). Deploy with Wrangler or the Pages Git integration.

Options and the feature support table are in the package README (`node_modules/astro-adapter-cloudflare-pages/README.md`). Tested versions are listed in https://github.com/otnc/astro-adapter-cloudflare-pages/blob/main/docs/compat-notes.md.
