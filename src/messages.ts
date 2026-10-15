// Every message the adapter shows or throws lives here, so wording and format stay the same everywhere.
//
// Format rules, enforced by messages.test.ts:
// - one line of plain ASCII, because emoji and box-drawing characters turn into garbage in some Windows terminals;
// - sentences, ending with a period, with a hint for the fix after the problem;
// - code, option names and file names in backticks.
//
// The logger is Astro's, which adds the adapter name and handles colors and the terminal. A second logging library would only make the output differ from Astro's.

const ISSUES_URL =
  "https://github.com/otnc/astro-adapter-cloudflare-pages/issues";

export const messages = {
  passThroughUnsupported:
    "`passThroughOnException` is not available in Cloudflare Pages Functions. See https://developers.cloudflare.com/pages/platform/known-issues/#pages-functions.",

  sharpUnsupported:
    "Cloudflare Pages cannot run sharp at request time, so the adapter switches the default image service to passthrough.",

  compilingImages:
    "Optimizing images of prerendered pages with sharp at build time; on-demand pages serve images unchanged.",

  enablingSessions: (binding: string) =>
    `Enabling sessions with Cloudflare KV using the "${binding}" binding. Add a KV namespace with that binding to your Pages project to use sessions.`,

  keepingRoutesFile:
    "Keeping the existing `_routes.json` instead of generating one.",

  tooManyHeaderRules: (count: number, limit: number) =>
    `\`_headers\` has ${count} rules, but Pages accepts at most ${limit} and ignores the whole file above that. Prerender fewer pages that have headers, or set \`staticHeaders: false\` so Astro puts the Content-Security-Policy in a \`<meta>\` tag.`,

  untestedAstro: (astroVersion: string, testedMajors: string) =>
    `This version of astro-adapter-cloudflare-pages is tested with Astro ${testedMajors}, but Astro ${astroVersion} is installed. Check ${ISSUES_URL} for a newer release or report what breaks.`,

  untestedAstroHint:
    "Set `unsafe: { allowUntestedAstro: true }` in the adapter options to build anyway.",

  wranglerMissing:
    "Install `wrangler` as a dev dependency to emulate Cloudflare bindings in `astro dev`. Continuing without `Astro.locals.runtime`.",

  miniflareMissing:
    'Install `miniflare` as a dev dependency to emulate Cloudflare bindings in `astro dev` with `tool: "miniflare"`. Continuing without `Astro.locals.runtime`.',

  cfRuntimeUnavailable:
    "The `cf` CLI does not provide a local runtime API yet, so `astro dev` uses the runtime of Wrangler. Bindings declared only in `cloudflare.config.*` are not available in development.",

  cfRuntimeUnavailableWithoutWrangler:
    "The `cf` CLI does not provide a local runtime API yet. Install `wrangler` as a dev dependency to emulate bindings in `astro dev`. Continuing without `Astro.locals.runtime`.",

  noBuildOutput:
    "No build output found. Run `astro build` before `astro preview`.",

  noPreviewBindings:
    "No bindings are configured for the preview. Declare variables, KV namespaces, D1 databases and R2 buckets in `platformProxy.miniflare`, or use `wrangler pages dev dist`.",

  previewListening: (url: string) => `Preview server listening on ${url}.`,

  runThroughNpm:
    "Run the end-to-end tests through npm with `npm run test:e2e`.",
} as const;
