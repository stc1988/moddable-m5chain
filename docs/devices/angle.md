# Angle API

M5Stack documentation: [Chain Angle](https://docs.m5stack.com/en/chain/Chain_Angle)

## TypeScript Exports

```ts
import M5ChainAngle, { AngleRotationDirection, type AngleConfiguration, type AngleConfigurationSnapshot } from "m5chainAngle";
```

`AngleRotationDirection` can also be used as a TypeScript type.

| Export | Description |
| --- | --- |
| `M5ChainAngle` | Default class export. |
| `AngleRotationDirection` | Rotation direction values: `CLOCKWISE = 0`, `COUNTERCLOCKWISE = 1`. |
| `AngleConfiguration` | Type accepted by `configure()`. |
| `AngleConfigurationSnapshot` | Type returned by `readConfiguration()`. |

## Capabilities

- Common device API
- LED API
- Sample API

## Usage

```ts
import M5ChainAngle, { AngleRotationDirection } from "m5chainAngle";

if (device.type === M5ChainAngle.DEVICE_TYPE) {
	const angle = device as M5ChainAngle;

	await angle.setLedColor(0, 255, 80);
	await angle.configure({ angle: { rotationDirection: AngleRotationDirection.CLOCKWISE } });

	angle.onSample = function () {
		const sample = this.sample();
		trace(`angle=${sample}\n`);
	};
}
```

## Device-specific Methods

| Method | Description |
| --- | --- |
| `await device.getAngle12Adc()` | Reads the 12-bit ADC value. |
| `await device.getAngle12Deg()` | Reads the angle in degrees across the device's 280-degree range. |
| `await device.getAngle12Value()` | Reads a normalized value rounded to two decimals. Range: `0.00` to `1.00`. |
| `await device.getAngle8Adc()` | Reads the 8-bit mapped ADC value. |
| `await device.configure({ angle })` | Applies angle configuration. |
| `await device.readConfiguration()` | Reads angle configuration from the device. |

## Configuration

| Option | Description |
| --- | --- |
| `angle.rotationDirection` | Sets rotation direction. Use `AngleRotationDirection.CLOCKWISE` (`0`) or `AngleRotationDirection.COUNTERCLOCKWISE` (`1`). |

## Sample Value

`onSample` is dispatched on every poll. `sample()` returns the normalized value from `getAngle12Value()`.
