# Symptoms, causes and fixes

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Dynamic routes return 404 on Pages, static pages work | `_routes.json` excludes the path, or a custom `public/_routes.json` replaced the generated one | Inspect `dist/_routes.json`. Remove the custom file, or add the path with `routes.extend.include`. |
| Build log or Pages rejects `_routes.json` | More than 100 include and exclude rules | The adapter falls back to `include: ["/*"]` on its own; a custom `public/_routes.json` must stay within the limit. |
| A redirect from `astro.config` does nothing on Pages | The path is also served by the Worker, and Pages applies `_redirects` only to requests that skip the Worker | Static redirects are written to `_redirects` and excluded from `_routes.json`. Check that `routes.extend.include` does not cover the redirect source. |
| `Astro.locals.runtime` is undefined in `astro dev` | Wrangler is not installed, or `platformProxy.enabled` is `false` | Install `wrangler` as a dev dependency. The adapter logs a warning when it cannot start the platform proxy. |
| `Astro.locals.runtime.env.X` is undefined | The binding is missing from the Wrangler config (local) or from the Pages project settings (deployed) | Add the binding to `wrangler.jsonc` and to the Pages project. For local secrets, use `.dev.vars`. |
| `EnvInvalidVariables: X is missing` | An `astro:env` variable in `env.schema` has no binding or secret with that name | Add the variable to `wrangler.jsonc` `vars`, to `.dev.vars`, or as a Pages secret. |
| `Invalid binding SESSION` | Sessions default to the KV binding `SESSION`, which does not exist | Add a KV namespace bound as `SESSION`, set `sessionKVBindingName`, or configure another `session.driver`. |
| `passThroughOnException is not available in Cloudflare Pages Functions` | Code calls `Astro.locals.runtime.ctx.passThroughOnException()` | Pages does not support it. Remove the call and handle errors in the page or middleware. |
| `Cannot find module 'cloudflare:workers'` during build or in `astro dev` | A prerendered page or dev-time code imports `cloudflare:*` | Read bindings from `Astro.locals.runtime.env` in on-demand pages. |
| Images are not resized | The adapter replaces sharp with the passthrough image service | Expected. Configure another `image.service` if resizing is required. |
| Cookies are not set on responses | The response was created outside Astro's rendering, for example in a custom handler | Set cookies with `Astro.cookies`; the adapter adds them to responses that Astro renders. |
| Build fails with "tested with Astro 6, 7" | An untested Astro major is installed | Use a supported Astro version, update the adapter, or set `unsafe: { allowUntestedAstro: true }` knowingly. |
| `cloudflare.config.ts` bindings missing in `astro dev` | The `cf` CLI has no local runtime API yet, so the adapter uses Wrangler's | Declare development bindings in a Wrangler config as well. |
