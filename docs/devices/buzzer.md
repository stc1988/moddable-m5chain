# Buzzer API

M5Stack documentation: [Chain Buzzer](https://docs.m5stack.com/en/chain/Chain_Buzzer)

Protocol: [Chain Buzzer Communication Protocol](https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1260/U224-Chain-Buzzer-Protocol-V1.0_en.pdf)

## TypeScript Exports

```ts
import M5ChainBuzzer, {
	BUZZER_MODE,
	BUZZER_NOTE,
	type BuzzerMode,
	type BuzzerNote,
	type ContinuousToneOptions,
	type NoteOptions,
	type ToneOptions,
} from "m5chainBuzzer";
```

The constants and types are also exported from `m5chain`.

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

## Capabilities

- Common device API
- LED API
- Timed tone playback
- Continuous tone playback
- Note playback

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

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.playTone(options)` | Starts a timed tone in auto playback mode. |
| `await device.startTone(options)` | Starts a continuous tone in manual playback mode. |
| `await device.stopTone()` | Stops manual continuous playback. |
| `await device.playNote(options)` | Starts a timed note in note playback mode. |
| `await device.setToneFrequency(frequencyHz)` | Changes the stored/manual tone frequency. |
| `await device.getToneFrequency()` | Reads the tone frequency in hertz. |
| `await device.setToneDutyCycle(dutyCycle)` | Changes the stored/manual duty cycle using a normalized `0` to `1` value. |
| `await device.getToneDutyCycle()` | Reads the duty cycle as a normalized `0` to `1` value. |
| `await device.getPlaybackMode()` | Reads the current mode as a `BuzzerMode`. |
| `await device.isToneActive()` | Reads the buzzer state flag. It is primarily meaningful in manual mode. |

Frequency and duty cycle are output state, not persistent device configuration, so they are not accepted by `configure()`.

## Playback and Cancellation

The protocol does not provide a playback-completion notification. It also does not define a dedicated command for cancelling a timed auto tone or note. Use `stopTone()` for tones started with `startTone()`.

The duty cycle controls the PWM waveform and is not exposed as volume because it is not a linear loudness value.
