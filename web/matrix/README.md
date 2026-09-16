# Matrix Studio

Browser-based 8x8 frame editor, preview, and Moddable code generator for M5Chain Mono and RGB.

The editor supports pointer and keyboard input, Mono/RGB switching, color and eraser tools, rotation, brightness,
multiple animation frames, a browser preview, and copy-ready calls to `configure()` and `writeFrame()`. Browser
brightness and color are illustrative; they are not a hardware simulation.

Mono and RGB share one application because their 8x8 display concepts are nearly identical. The `device=mono` and
`device=rgb` query parameters select the initial mode. Switching preserves the frames: RGB-to-Mono treats every
non-black pixel as on.

## Animation behavior

Chain Mono and RGB do not provide a wire command for arbitrary frame animation. Generated code uses the library's
`playAnimation()` API, which sends each frame and awaits the device response before waiting for the next frame. This
prevents overlapping UART requests. The configured frame time is therefore a minimum hold time; actual frame rate also
includes the device round trip and may vary. This is intended for low-rate pixel animation, not video.

The browser preview uses the requested interval directly and cannot predict hardware transfer timing. Single-frame
projects generate a simple `writeFrame()` call without a timer.

## WebMCP

When the experimental `document.modelContext` API is available, the application registers these tools:

| Tool | Purpose |
| --- | --- |
| `get_matrix_state` | Read settings, frames, playback state, and generated code. |
| `configure_matrix` | Change device, rotation, brightness, frame time, or loop behavior. |
| `set_matrix_pixel` | Set or clear one pixel in a selected frame. |
| `add_matrix_frame` | Append a blank frame or duplicate the current frame. |
| `select_matrix_frame` | Select a frame for editing. |
| `delete_matrix_frame` | Delete a frame while retaining at least one. |
| `preview_matrix_animation` | Start browser-only playback. |
| `stop_matrix_animation` | Stop browser playback. |

All mutation inputs are validated before the visible state changes. Tool results are JSON strings containing either
`{ "ok": true, "state": ... }` or `{ "ok": false, "error": "..." }`. WebMCP controls only this browser editor; it
does not connect to M5Chain hardware.

## Technical constraints

- Mono code packs eight row bytes, with bit 7 representing X=0.
- RGB code emits 64 colors in row-major order. The device converts them to RGB565.
- Rotation accepts 0, 90, 180, or 270 degrees; brightness accepts integers from 0 through 255.
- Frame time accepts integers from 20 through 60,000 ms.
- Direct USB/UART control, firmware-font-perfect text previews, image quantization, and file import/export are not
  implemented.

## Local development

From the repository root:

```sh
npm ci --prefix web
npm run web:dev
```

Build the complete multi-page site with `npm run web:build`. This application is written to `web/dist/matrix`.

## GitHub Pages

The application is published at `https://stc1988.github.io/moddable-m5chain/matrix/`. The `device=mono` and
`device=rgb` query parameters select the initial editor mode.
