# Web Matrix Studio requirements

## Goal

Add a browser-only tool for designing and previewing content for M5Chain Mono and RGB displays and generating code
that uses the public `m5chainMono` and `m5chainRGB` APIs. The tool should be as easy to discover, run, and deploy as
`web/buzzer`.

## Product decision

Mono and RGB share the same 8x8 display concepts and most controls, so they are implemented as one application at
`web/matrix/`, with a device selector. This avoids two editors drifting apart while still generating device-specific
code. The site index may link to the same application with `?device=mono` and `?device=rgb` so each device has a direct
entry point.

## Required behavior

- Select Mono or RGB without reloading the page. A valid `device` query parameter chooses the initial device.
- Edit all 64 pixels in an accessible 8x8 grid. Pointer dragging paints multiple pixels.
- Mono pixels toggle between off and on. RGB pixels use a selected color; an eraser writes black.
- Clear the frame and load a recognizable sample frame.
- Configure rotation (0, 90, 180, or 270 degrees) and brightness (integer 0 through 255).
- Preview brightness and rotation in the browser. The preview is illustrative; hardware color, heat, and optical
  brightness are not claimed to be exact.
- Generate copy-ready TypeScript using `configure()` followed by the device's `writeFrame()` API.
- For Mono, emit exactly eight row bytes, with bit 7 corresponding to X=0.
- For RGB, emit exactly 64 `{ r, g, b }` values in row-major order.
- Keep editor state when switching device types so a Mono mask can become an RGB frame and an RGB frame can become a
  Mono mask. RGB-to-Mono conversion treats any non-black pixel as on.
- Work without a server or runtime dependency after the Vite production build.
- Remain usable on narrow screens and with a keyboard. Status changes use an `aria-live` region.

## Integration and deployment

- Add root npm scripts for local development and production builds.
- Add the application to `web/index.html` and document it in `web/README.md`.
- Update `.github/workflows/deploy-pages.yml` to install, build, and copy the matrix application into the same Pages
  artifact as the index and buzzer application.
- The production Vite base must be `/moddable-m5chain/matrix/`.

## Validation and acceptance

- Unit tests cover Mono row packing, RGB row-major output, device conversion, and generated API calls.
- `npm run format`, `npm run lint`, `npm test`, and `npm run matrix-preview:build` pass.
- Inspect the production `dist/index.html` and confirm assets use the configured Pages base.
- Browser checks cover device switching, mouse/pointer painting, keyboard activation, reset/sample actions, live code
  updates, and clipboard feedback at desktop and mobile widths.

## Out of scope for this iteration

- Direct USB/UART communication with physical hardware.
- Exact simulation of LED color, diffusion, power draw, heat, or brightness.
- Firmware-font-perfect `drawCharacter()` or `scrollText()` animation. These APIs can be added later without changing
  the frame editor or its URL.
- Import/export file formats, animation timelines, image quantization, and WebMCP tools.

## Handoff notes

The device API documentation in `docs/devices/mono.md` and `docs/devices/rgb.md` and the implementations in
`src/m5chain/m5chainDevices/` are authoritative. The browser tool deliberately owns its small conversion helpers so
it does not bundle embedded runtime modules. Any future scrolling UI must preserve the Mono/RGB horizontal direction
mapping difference already absorbed by the device classes, and RGB fixed black scrolling text must remain rejected
because wire color zero selects the firmware gradient.
