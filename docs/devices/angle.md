# Angle API

M5Stack documentation: [Chain Angle](https://docs.m5stack.com/en/chain/Chain_Angle)

## TypeScript Exports

```ts
import M5ChainAngle from "m5chainAngle";
```

| Export | Description |
| --- | --- |
| `M5ChainAngle` | Default class export. |

## Capabilities

- Common device API
- LED API
- Poll API

## Usage

```ts
import M5ChainAngle from "m5chainAngle";

if (device.type === M5ChainAngle.DEVICE_TYPE) {
	const angle = device as M5ChainAngle;

	await angle.setLedColor(0, 255, 80);

	angle.onPoll = (value) => {
		trace(`angle=${value}\n`);
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
| `await device.setAngleRotationDirection(direction)` | Sets rotation direction. `0`: clockwise, `1`: counterclockwise. |
| `await device.getAngleRotationDirection()` | Reads rotation direction. |

## Poll Value

`onPoll` receives the normalized value from `getAngle12Value()`. It dispatches when the value changes.
