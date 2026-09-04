# Buzzer Tone Studio

Browser-based tone preview and Moddable code generator for the M5Chain Buzzer.

## Features

- Timed tones using `playTone()`
- Notes from `BUZZER_NOTE.REST` through `BUZZER_NOTE.C8`
- Editable melodies using `playMelody()`, including rests, fractional beats, tempo, and gate ratio
- Estimated playback time for tones and complete melodies
- Melody import from pasted `note,beats` CSV text
- Continuous tones using `startTone()` and `stopTone()`
- Copy-ready code that follows the public API in `docs/devices/buzzer.md`

The note frequencies match the M5Stack Chain Buzzer firmware table. Browser preview volume is intentionally separate from the generated `dutyCycle` value because duty cycle is not a linear loudness control.

The melody editor starts with the sample sequence from the Buzzer API design discussion. Every change updates the estimated duration and generated Moddable code immediately.

CSV import accepts an optional `note,beats` header and note names such as `C5`, `BUZZER_NOTE.C5`, `NOTE_AS4`, and `NOTE_REST`. Beats may be decimals or fractions such as `2/3`. The current sequence is replaced only after every row passes validation.

The app uses browser-native DOM, Web Audio, and Clipboard APIs. Its only development dependencies are Vite, TypeScript, and Biome; the production build has no runtime dependencies. PWM duty-cycle controls remain available for raw tone playback because they map directly to the device API; melody notes use the firmware's fixed 50% note waveform.

## Local development

From the repository root:

```sh
npm ci --prefix web/buzzer
npm run buzzer-preview:dev
```

Then open the local URL shown by the development server. Build the deployable site with:

```sh
npm run buzzer-preview:build
```

The output in `web/buzzer/dist` is a static site that can be served by any static web host.

## GitHub Pages

The application is published at `https://stc1988.github.io/moddable-m5chain/buzzer/`. Its Vite base path must remain
aligned with that location. The repository-wide workflow documented in `web/README.md` builds and deploys this app
together with the site index and any future web applications.

## WebMCP

The page registers five tools through the experimental `document.modelContext` imperative API:

| Tool | Purpose |
| --- | --- |
| `get_buzzer_state` | Read current settings, melody, playback status, estimated duration, audio readiness, and generated code. |
| `configure_buzzer` | Change mode, frequency, duty, duration, note, preview volume, tempo, or gate percentage. |
| `import_buzzer_melody` | Replace the melody using `note,beats` CSV and select melody mode. |
| `preview_buzzer` | Start browser preview with the current settings. |
| `stop_buzzer_preview` | Stop playback, including continuous tones. |

Settings use the same names as the returned state: `mode` (`tone`, `note`, `melody`, `continuous`),
`frequencyHz` (integer 100–10000), `dutyPercent` and `previewVolume` (integer 0–100),
`durationMs` (integer 0–65535), `noteConstant` (e.g. `C5`, `A_SHARP_4`, `REST`),
`tempoBpm` (1–1000), and `gatePercent` (1–100). Omitted settings remain unchanged.
Tool input is validated before any settings are changed. CSV uses the same parser as the visible import button.
Updates stop playback and refresh the visible editor and generated code; they do not start audio.

Results are JSON strings containing `{ "ok": true, "state": ... }` or `{ "ok": false, "error": "..." }`.
`durationMs` remains the configured tone/note duration; `estimatedDurationMs` reflects the selected mode and is
`null` for continuous playback. `generatedCode` can be read directly without clipboard access.
Preview returns immediately after requesting playback; read the state again for progress or errors.
The user must click **Preview** once to enable browser audio before an agent can start it, and the tab must be visible.
These tools only operate the browser preview; they do not connect to a physical buzzer.

To try locally, enable `chrome://flags/#enable-webmcp-testing` in a compatible Chrome version, restart Chrome,
and open the development URL. Use the **Model Context Tool Inspector** extension linked from the
[Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp?hl=ja) to inspect and invoke tools.
For example, call `configure_buzzer` with `{"mode":"note","noteConstant":"C5","durationMs":250}`,
then `get_buzzer_state` with `{}` and check the visible fields and generated `playNote()` code.
Try an invalid frequency such as `{"frequencyHz":99}` and verify the previous settings remain unchanged.

This implementation follows the [document-based imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api).
It does not use the deprecated `navigator.modelContext` API. Browsers without WebMCP keep the ordinary interface.
Registration failures are logged without preventing normal use. Production availability depends on browser support
and trial enrollment; no origin-trial token is bundled. The page must remain open for tools to be discoverable.
