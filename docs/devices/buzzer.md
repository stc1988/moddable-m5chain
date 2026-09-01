# Buzzer API

M5Stack documentation: [Chain Buzzer](https://docs.m5stack.com/en/chain/Chain_Buzzer)

Protocol: [Chain Buzzer Communication Protocol](https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1260/U224-Chain-Buzzer-Protocol-V1.0_en.pdf)

## Browser Tone Preview

The local `tools/buzzer-preview` app plays an approximation of Buzzer tones and melodies in the browser and generates copy-ready Moddable code for `playTone()`, `playNote()`, `playMelody()`, or continuous playback. The melody editor shows an estimated playback time and can replace its sequence from pasted `note,beats` CSV text. Install it once with `npm ci --prefix tools/buzzer-preview`, then start it from the repository root with `npm run buzzer-preview:dev`.

Playback starts only after pressing a preview button because browsers require a user gesture before producing audio. The preview approximates the device's PWM duty cycle in its audio synthesis. It is useful for checking pitch, duration, note choice, and the character of a duty-cycle setting, but speaker hardware and browser audio processing mean it will not sound identical to the physical Buzzer.

## TypeScript Exports

```ts
import M5ChainBuzzer, {
	BUZZER_MODE,
	BUZZER_NOTE,
	type BuzzerMode,
	type BuzzerNote,
	type ContinuousToneOptions,
	type MelodyOptions,
	type MelodyStep,
	type NoteOptions,
	type ToneOptions,
} from "m5chainBuzzer";
```

The constants and types are exported from `m5chainBuzzer` so the M5Chain core does not depend on Buzzer code.

| Export | Description |
| --- | --- |
| `M5ChainBuzzer` | Default class export. |
| `BUZZER_MODE` | Protocol playback modes: `AUTO`, `MANUAL`, and `NOTE`. |
| `BUZZER_NOTE` | `REST`, chromatic notes from `C3` through `B7`, and `C8`. |
| `BuzzerMode` | Union of values in `BUZZER_MODE`. |
| `BuzzerNote` | Union of values in `BUZZER_NOTE`. |
| `ToneOptions` | Options accepted by `playTone()`. |
| `ContinuousToneOptions` | Options accepted by `startTone()`. |
| `NoteOptions` | Options accepted by `playNote()`. |
| `MelodyStep` | A note or rest and its duration in beats. |
| `MelodyOptions` | Tempo and optional note gate accepted by `playMelody()`. |

## Capabilities

- Common device API
- LED API
- Timed tone playback
- Continuous tone playback
- Note playback
- Melody playback with rests and cancellable host-side timing

The Buzzer is an output-only device. It does not provide `onSample`, key events, or playback-completion events.

## Timed Tone

```ts
await buzzer.playTone({
	frequencyHz: 1000,
	dutyCycle: 0.5,
	durationMs: 500,
});
```

`playTone()` selects auto playback mode and starts the requested tone. Its promise resolves when the device accepts the command, not when playback completes.

| Option | Description |
| --- | --- |
| `frequencyHz` | Integer from `100` to `10000`. |
| `durationMs` | Integer from `0` to `65535`. The protocol accepts `0` but does not define a special meaning for it. |
| `dutyCycle` | Optional value from `0` to `1`. Defaults to `0.5`. |

## Continuous Tone

```ts
await buzzer.startTone({
	frequencyHz: 2700,
	dutyCycle: 0.5,
});

await buzzer.setToneFrequency(3200);
await buzzer.stopTone();
```

`startTone()` selects manual playback mode, applies the frequency and duty cycle, and turns the buzzer on. `stopTone()` selects manual mode and turns it off.

## Note Playback

```ts
await buzzer.playNote({
	note: BUZZER_NOTE.C4,
	durationMs: 250,
});
```

Sharp notes use names such as `BUZZER_NOTE.C_SHARP_4`. `BUZZER_NOTE.REST` plays the protocol's `0 Hz` rest entry.

## Melody Playback

```ts
const melody = [
	{ note: BUZZER_NOTE.C5, beats: 1.5 },
	{ note: BUZZER_NOTE.G4, beats: 0.5 },
	{ note: BUZZER_NOTE.REST, beats: 1 },
	{ note: BUZZER_NOTE.E4, beats: 1 },
	{ note: BUZZER_NOTE.G4, beats: 2 / 3 },
] as const;

await buzzer.playMelody(melody, {
	tempoBpm: 120,
	gateRatio: 0.9,
});
```

`playMelody()` is the recommended API when timing several notes or rests. The Chain Buzzer protocol has no melody queue, so the library schedules each step on the host, selects note mode once, and compensates for command time to reduce accumulated drift. Its promise resolves after the melody finishes. Starting `playTone()`, `startTone()`, `stopTone()`, `playNote()`, or another melody cancels the remaining steps.

Call `await buzzer.stopMelody()` to cancel the remaining sequence and send `BUZZER_NOTE.REST` to the device. The active `playMelody()` promise then resolves normally.

| Option | Description |
| --- | --- |
| `tempoBpm` | Finite number greater than `0`. One beat is `60000 / tempoBpm` milliseconds. |
| `gateRatio` | Optional sounding fraction of each non-rest step, greater than `0` and at most `1`. Defaults to `0.9`. |

Each `MelodyStep` contains a valid `BUZZER_NOTE` value and a finite `beats` value greater than `0`. A rounded step duration must fit the protocol's `1` to `65535` ms range. Prefer exact expressions such as `2 / 3` when a repeating fraction is intended.

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.playTone(options)` | Starts a timed tone in auto playback mode. |
| `await device.startTone(options)` | Starts a continuous tone in manual playback mode. |
| `await device.stopTone()` | Stops manual continuous playback. |
| `await device.playNote(options)` | Starts a timed note in note playback mode. |
| `await device.playMelody(melody, options)` | Plays a host-scheduled sequence of notes and rests. |
| `await device.stopMelody()` | Cancels a melody and silences its current note. |
| `await device.setToneFrequency(frequencyHz)` | Changes the stored/manual tone frequency. |
| `await device.getToneFrequency()` | Reads the tone frequency in hertz. |
| `await device.setToneDutyCycle(dutyCycle)` | Changes the stored/manual duty cycle using a normalized `0` to `1` value. |
| `await device.getToneDutyCycle()` | Reads the duty cycle as a normalized `0` to `1` value. |
| `await device.getPlaybackMode()` | Reads the current mode as a `BuzzerMode`. |
| `await device.isToneActive()` | Reads the buzzer state flag. It is primarily meaningful in manual mode. |

Frequency and duty cycle are output state, not persistent device configuration, so they are not accepted by `configure()`.

## Playback and Cancellation

The protocol does not provide a playback-completion notification. It also does not define a dedicated command for cancelling a timed auto tone or note. Use `stopTone()` for tones started with `startTone()`. Melody completion and cancellation are host-managed; `stopMelody()` sends the protocol's rest note to silence the current step.

The duty cycle controls the PWM waveform and is not exposed as volume because it is not a linear loudness value.
