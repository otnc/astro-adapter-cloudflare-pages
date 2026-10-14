# Compatibility notes

Results of experiments about how Astro and Cloudflare Pages behave with this adapter. Record every result here, including negative ones, with the date, the versions used, and the fixture that covers it. When a result contradicts an earlier note, update the note and say so in the commit message.

## Tested versions

No version has been tested yet. Until a fixture covers a version, the README must not claim support for it.

| Astro | Wrangler | Fixture | Result | Date |
| --- | --- | --- | --- | --- |

## Open questions

| # | Question | Status |
| --- | --- | --- |
| 1 | Do Astro 6 and 7 still honor `build.server` and `build.serverEntry` the way `@astrojs/cloudflare` v12 relied on? | Open |
| 2 | How does the Astro 7 Advanced Routing entrypoint (`src/fetch.ts`) combine with a Pages `_worker.js` bundle? | Open |
| 3 | Does Pages accept the bundle that Astro 6 and 7 produce (module format, size, `cloudflare:*` imports, Node.js compatibility flags)? | Open |
| 4 | How can prerendering run in workerd without the official adapter, or should it fall back to Node.js prerendering? | Open |
| 5 | Can the `cf` CLI deploy to Pages, which config file does it read, and does it have a programmatic local runtime API? | Open |

## Adapter API differences by Astro version

| Astro | Difference | Workaround | Fixture |
| --- | --- | --- | --- |
