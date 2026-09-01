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
