# MIC API

M5Stack documentation: [Chain MIC](https://docs.m5stack.com/en/chain/Chain_MIC)

Official driver: [M5Stack M5Chain ChainMIC](https://github.com/m5stack/M5Chain/tree/main/src/ChainMIC)

## TypeScript Exports

```ts
import M5ChainMIC, {
	MIC_REPORT_MODE,
	MIC_TRIGGER,
	type MICConfiguration,
	type MICConfigurationSnapshot,
	type MICReportMode,
	type MICThresholdHandler,
	type MICTrigger,
} from "m5chainMIC";
```

| Export | Description |
| --- | --- |
| `M5ChainMIC` | Default class export. |
| `MIC_REPORT_MODE` | Automatic report settings: `DISABLED = 0`, `ENABLED = 1`. |
| `MIC_TRIGGER` | Threshold crossings: `LOW_THRESHOLD = 0x0300`, `HIGH_THRESHOLD = 0x0301`. |
| `MICConfiguration` | Type accepted by `configure()`. |
| `MICConfigurationSnapshot` | Type returned by `readConfiguration()`. |
| `MICThresholdHandler` | Handler type used by `onThresholdCrossed`. |

## Capabilities

- Common device API
- LED API
- Sample API
- Automatic threshold-crossing events

## Usage

Register this class in `deviceClasses`. Use the following inside an async `onDeviceListChanged` handler
while iterating its `devices` list; see the [complete pattern](README.md#import-pattern).

```ts
import M5ChainMIC, { MIC_REPORT_MODE, MIC_TRIGGER } from "m5chainMIC";

if (device.kind === "mic") {
	const mic = device;

	await mic.configure({
		threshold: 2048,
		reportMode: MIC_REPORT_MODE.ENABLED,
		triggerIntervalMs: 300,
	});

	mic.onSample = (adc) => trace(`microphone ADC=${adc}\n`);
	mic.onThresholdCrossed = (trigger) => {
		const above = trigger === MIC_TRIGGER.HIGH_THRESHOLD;
		trace(`microphone above threshold=${above}\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getMic12Adc()` | Reads the 12-bit microphone signal (`0` to `4095`). |
| `await device.getMic8Adc()` | Reads the mapped 8-bit microphone signal (`0` to `255`). |
| `await device.configure(options)` | Applies threshold, report-mode, and trigger-interval configuration. |
| `await device.readConfiguration()` | Reads the current threshold, report mode, and trigger interval. |

## Configuration

| Option | Description |
| --- | --- |
| `threshold` | Sets the 12-bit crossing threshold from `0` to `4095`. |
| `reportMode` | Enables or disables automatic low/high threshold reports. |
| `triggerIntervalMs` | Limits repeated trigger reports to an interval from `300` to `1000` milliseconds. |
| `saveToFlash` | Persists `threshold` when `true`. It requires `threshold` in the same call and defaults to `false`. |

Saving to flash requires a page erase. Avoid setting `saveToFlash` on frequent configuration updates because repeated writes reduce device flash life.

## Sample and Event Values

`onSample` receives the latest 12-bit microphone ADC value (`0` to `4095`) on every poll. `sample()` returns the latest
cached value. Use `onThresholdCrossed` when the device's threshold-driven automatic report is preferable to periodic
polling. A rising crossing reports `MIC_TRIGGER.HIGH_THRESHOLD`; a falling crossing reports `MIC_TRIGGER.LOW_THRESHOLD`.
