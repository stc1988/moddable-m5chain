# Web applications

Browser applications in this directory are published together as one GitHub Pages site:

- `web/index.html` is the site index at `https://stc1988.github.io/moddable-m5chain/`.
- Each application is built into its own subdirectory. For example, `web/buzzer` is published at
  `https://stc1988.github.io/moddable-m5chain/buzzer/`.

The deployment workflow builds every application and assembles one Pages artifact. A deployment must always include
all applications because a Pages deployment replaces the previously published artifact.

## Adding an application

1. Create the application under `web/<application-name>`.
2. Configure its production asset base for `/moddable-m5chain/<application-name>/`.
3. Add its install, build, and artifact-copy steps to `.github/workflows/deploy-pages.yml`.
4. Add the application to `web/index.html`.
5. Run the application's local build and verify its generated asset paths.

GitHub Pages must use **GitHub Actions** as its source under the repository's **Settings > Pages** configuration.
