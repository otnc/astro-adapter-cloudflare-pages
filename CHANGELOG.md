# Changelog

All notable changes to this project are documented here. This file is generated from commit messages by [git-cliff](https://git-cliff.org) when the `release` workflow runs.

## [0.3.0](https://github.com/otnc/astro-adapter-cloudflare-pages/releases/tag/v0.3.0) - 2026-10-15

### Features

- Write the headers of static pages to _headers (#23)
- Import .wasm, .bin and .txt files with cloudflareModules (#25)
- Read bindings from wrangler.jsonc and wrangler.toml for Miniflare (#27)
- Replace the Worker entry with workerEntryPoint (#28)
- Add the workers target for Workers with static assets (#29)
- Support Miniflare 5 by converting the Miniflare 4 options (#30)

### Refactoring

- Unify logging and split the integration into modules (#24)
- Split the preview entrypoint and share the Miniflare binding options (#26)

## [0.2.0](https://github.com/otnc/astro-adapter-cloudflare-pages/releases/tag/v0.2.0) - 2026-10-15

### Features

- **tooling:** Add tool miniflare to run astro dev without Wrangler (#20)
- Support astro preview by serving the build in Miniflare (#22)

### Bug fixes

- Keep LICENSE as plain MIT and move the third-party notice to its own file (#19)

### Documentation

- Mention the Workers recommendation once, in a note (#17)
- Say that the adapter also runs on Miniflare, verified by a new e2e test (#21)

## [0.1.0](https://github.com/otnc/astro-adapter-cloudflare-pages/releases/tag/v0.1.0) - 2026-10-14

### Features

- Add the Cloudflare Pages adapter for Astro 6 and 7 (#7)
- **skills:** Add agent skills and document the adapter for the first release (#10)
- Add the imageService option with compile, passthrough, cloudflare and custom (#14)

### Bug fixes

- Expose astro:env variables from bindings in astro dev (#9)
- Run server islands and unknown paths correctly on Pages, and test more features (#12)

### Documentation

- Correct cf CLI support and plan for life after Wrangler (#11)
- Record the real Pages deployment and wrangler's --force requirement (#15)

[0.3.0]: https://github.com/otnc/astro-adapter-cloudflare-pages/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/otnc/astro-adapter-cloudflare-pages/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/otnc/astro-adapter-cloudflare-pages/releases/tag/v0.1.0

