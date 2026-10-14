---
name: astro-cloudflare-pages-troubleshoot
description: Diagnose problems with Astro sites deployed to Cloudflare Pages through the unofficial astro-adapter-cloudflare-pages adapter, such as 404s on dynamic routes, _routes.json or _redirects not applying, missing bindings, Astro.locals.runtime undefined, EnvInvalidVariables from astro:env, session errors about the SESSION binding, missing Set-Cookie headers, or passThroughOnException errors. Use only when the project depends on astro-adapter-cloudflare-pages; for @astrojs/cloudflare on Workers, use that adapter's documentation.
---

# astro-cloudflare-pages-troubleshoot

Find the cause of a build, development or runtime problem in a project that uses `astro-adapter-cloudflare-pages`, reproduce it locally, and apply the matching fix.

## When to use

- The project depends on `astro-adapter-cloudflare-pages`, and something fails in `astro dev`, `astro build`, `wrangler pages dev` or on the deployed Pages site.
- Not for projects on `@astrojs/cloudflare` or on Cloudflare Workers.

## Instructions

1. Collect the versions of `astro`, `astro-adapter-cloudflare-pages`, and `wrangler` or `cf` from the lockfile.
2. Find where it fails: `astro dev`, `astro build`, `wrangler pages dev dist`, or the deployed site.
3. Check the build output: `dist/_worker.js/index.js`, `dist/_routes.json` and `dist/_redirects` must exist after `astro build`.
4. Reproduce locally with `npx astro build && npx wrangler pages dev dist` before touching the deployed project.
5. Match the symptom in [references/symptoms.md](references/symptoms.md) and apply the fix it names. Prefer fixing configuration over patching files in `node_modules`.
6. If nothing matches, compare the versions with https://github.com/otnc/astro-adapter-cloudflare-pages/blob/main/docs/compat-notes.md and suggest opening an issue with a minimal reproduction.
7. Ask the user before deploying, creating Cloudflare resources, rotating secrets or changing Pages project settings. Never print or commit secrets, tokens or account IDs.
