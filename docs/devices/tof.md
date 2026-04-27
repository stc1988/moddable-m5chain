# ToF API

M5Stack documentation: [Chain ToF](https://docs.m5stack.com/en/chain/Chain_ToF)

## TypeScript Exports

```ts
import M5ChainToF, {
	type MeasurementCompletionFlag,
	type MeasurementMode,
	type MeasurementStatus,
} from "m5chainToF";
```

| Export | Description |
| --- | --- |
| `M5ChainToF` | Default class export. |
| `MeasurementMode` | `0 \| 1 \| 2`; stop, single, or continuous measurement. |
| `MeasurementStatus` | `0 \| 1`; idle or measuring. |
| `MeasurementCompletionFlag` | `0 \| 1`; incomplete or complete. |

## Capabilities

- Common device API
- LED API
- Poll API

## Usage

```ts
import M5ChainToF from "m5chainToF";

if (device.type === M5ChainToF.DEVICE_TYPE) {
	const tof = device as M5ChainToF;

	await tof.setLedColor(80, 80, 255);
	await tof.setMeasurementTime(50);
	await tof.setMeasurementMode(M5ChainToF.MEASUREMENT_MODE.CONTINUOUS);

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
| `await device.setMeasurementMode(mode)` | Sets mode. `0`: stop, `1`: single, `2`: continuous. |
| `await device.getMeasurementMode()` | Reads measurement mode. |
| `await device.setMeasurementStatus(status)` | Sets status. `0`: idle, `1`: measuring. |
| `await device.getMeasurementStatus()` | Reads measurement status. |
| `await device.getMeasurementCompletionFlag()` | Reads completion flag. |
| `await device.isMeasurementComplete()` | Returns `true` when completion flag is `1`. |
| `await device.triggerMeasurement()` | Starts a measurement by setting status to measuring. |

## Poll Value

`onPoll` receives the measured distance in millimeters. It dispatches when the distance changes.
