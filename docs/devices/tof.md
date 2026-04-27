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
| `MeasurementMode` | Named values: `STOP`, `SINGLE`, or `CONTINUOUS`. |
| `MeasurementStatus` | Named values: `IDLE` or `MEASURING`. |
| `MeasurementCompletionFlag` | Named values: `INCOMPLETE` or `COMPLETE`. |

## Capabilities

- Common device API
- LED API
- Poll API

## Usage

```ts
import M5ChainToF, { MeasurementMode } from "m5chainToF";

if (device.type === M5ChainToF.DEVICE_TYPE) {
	const tof = device as M5ChainToF;

	await tof.setLedColor(80, 80, 255);
	await tof.setMeasurementTime(50);
	await tof.setMeasurementMode(MeasurementMode.CONTINUOUS);

	tof.onPoll = (distance) => {
		trace(`distance=${distance}mm\n`);
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
| `await device.setMeasurementMode(mode)` | Sets mode. Use `MeasurementMode.STOP`, `MeasurementMode.SINGLE`, or `MeasurementMode.CONTINUOUS`. |
| `await device.getMeasurementMode()` | Reads measurement mode as a `MeasurementMode` value. |
| `await device.setMeasurementStatus(status)` | Sets status. Use `MeasurementStatus.IDLE` or `MeasurementStatus.MEASURING`. |
| `await device.getMeasurementStatus()` | Reads measurement status as a `MeasurementStatus` value. |
| `await device.getMeasurementCompletionFlag()` | Reads completion flag as `MeasurementCompletionFlag.INCOMPLETE` or `MeasurementCompletionFlag.COMPLETE`. |
| `await device.isMeasurementComplete()` | Returns `true` when completion flag is `MeasurementCompletionFlag.COMPLETE`. |
| `await device.triggerMeasurement()` | Starts a measurement by setting status to measuring. |

## Poll Value

`onPoll` receives the measured distance in millimeters. It dispatches when the distance changes.
