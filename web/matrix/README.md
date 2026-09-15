# Matrix Studio

Browser-based 8x8 frame editor, preview, and Moddable code generator for M5Chain Mono and RGB.

The editor supports pointer and keyboard input, Mono/RGB switching, color and eraser tools, rotation, brightness, a
sample frame, and copy-ready calls to `configure()` and `writeFrame()`. Browser brightness and color are illustrative;
they are not a hardware simulation.

See [`docs/requirements/web-matrix-studio.md`](../../docs/requirements/web-matrix-studio.md) for the product scope,
acceptance criteria, and handoff notes.

## Local development

From the repository root:

```sh
npm ci --prefix web/matrix
npm run matrix-preview:dev
```

Build the static site with `npm run matrix-preview:build`. Output is written to `web/matrix/dist`.

## GitHub Pages

The application is published at `https://stc1988.github.io/moddable-m5chain/matrix/`. The `device=mono` and
`device=rgb` query parameters select the initial editor mode.
