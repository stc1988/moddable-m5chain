# ToF API

M5Stack documentation: [Chain ToF](https://docs.m5stack.com/en/chain/Chain_ToF)

## TypeScript Exports

```ts
import M5ChainToF, {
	MeasurementMode,
	MeasurementCompletionFlag,
	MeasurementStatus,
} from "m5chainToF";
```

These exports can also be used as TypeScript types.

| Export | Description |
| --- | --- |
| `M5ChainToF` | Default class export. |
| `MeasurementMode` | Measurement mode values: `STOP = 0`, `SINGLE = 1`, `CONTINUOUS = 2`. |
| `MeasurementStatus` | Measurement status values: `IDLE = 0`, `MEASURING = 1`. |
| `MeasurementCompletionFlag` | Completion flag values: `INCOMPLETE = 0`, `COMPLETE = 1`. |

## Capabilities

- Common device API
- LED API
- Sample API

## Usage

```ts
import M5ChainToF, { MeasurementMode } from "m5chainToF";

if (device.type === M5ChainToF.DEVICE_TYPE) {
	const tof = device as M5ChainToF;

	await tof.setLedColor(80, 80, 255);
	await tof.setMeasurementTime(50);
	await tof.setMeasurementMode(MeasurementMode.CONTINUOUS);

	tof.onSample = function () {
		const sample = this.sample();
		trace(`distance=${sample}mm\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getDistance()` | Reads measured distance in millimeters. |
| `await device.getMeasurementDistance()` | Alias for `getDistance()`. |
| `await device.setMeasurementTime(time)` | Sets measurement time. Range: `20` to `200` ms. |
| `await device.getMeasurementTime()` | Reads measurement time in milliseconds. |
| `await device.setMeasurementMode(mode)` | Sets mode. Use `MeasurementMode.STOP` (`0`), `MeasurementMode.SINGLE` (`1`), or `MeasurementMode.CONTINUOUS` (`2`). |
| `await device.getMeasurementMode()` | Reads measurement mode as a `MeasurementMode` value. |
| `await device.setMeasurementStatus(status)` | Sets status. Use `MeasurementStatus.IDLE` (`0`) or `MeasurementStatus.MEASURING` (`1`). |
| `await device.getMeasurementStatus()` | Reads measurement status as a `MeasurementStatus` value. |
| `await device.getMeasurementCompletionFlag()` | Reads completion flag as `MeasurementCompletionFlag.INCOMPLETE` (`0`) or `MeasurementCompletionFlag.COMPLETE` (`1`). |
| `await device.isMeasurementComplete()` | Returns `true` when completion flag is `MeasurementCompletionFlag.COMPLETE` (`1`). |
| `await device.triggerMeasurement()` | Starts a measurement by setting status to measuring. |

## Sample Value

`onSample` is dispatched on every poll. `sample()` returns the measured distance in millimeters.
