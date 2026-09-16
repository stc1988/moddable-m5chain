# Web applications

Browser applications in this directory are built as one Vite multi-page site and published together to GitHub Pages:

- `web/index.html` is the site index at `https://stc1988.github.io/moddable-m5chain/`.
- Each application is built into its own subdirectory. For example, `web/buzzer` is published at
  `https://stc1988.github.io/moddable-m5chain/buzzer/`.
- `web/matrix` provides one shared Mono/RGB frame editor at
  `https://stc1988.github.io/moddable-m5chain/matrix/`.

The pages share one toolchain and dependency lockfile while keeping separate HTML and TypeScript entry points. Run
`npm ci --prefix web` once, then use `npm run web:dev` from the repository root to serve the index and both tools.
`npm run web:build` produces the complete Pages artifact in `web/dist`. Run the web-only tests with
`npm --prefix web test`; the repository-level `npm test` runs both library and web tests.

## Adding an application

1. Create the application under `web/<application-name>` with its own `index.html` and source directory.
2. Add its HTML entry point to `build.rollupOptions.input` in `web/vite.config.ts`.
3. Add the application to `web/index.html`.
4. Run `npm run web:build` and verify its generated page and asset paths under `web/dist`.

GitHub Pages must use **GitHub Actions** as its source under the repository's **Settings > Pages** configuration.
