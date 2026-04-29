# HasLed API

`HasLed` adds RGB LED configuration support to a device class.

## TypeScript Exports

```ts
import HasLed from "hasLed";
import type { LedColor } from "types";
```

| Export | Description |
| --- | --- |
| `HasLed` | Default mixin export. |
| `LedColor` | `{ r: number; g: number; b: number }`, exported from `types`. |

## Used By

- Encoder
- Angle
- Key
- JoyStick
- ToF

## Configuration

Use the device's `configure()` method to update LED settings:

```ts
await device.configure({
	led: {
		color: { r: 255, g: 0, b: 0 },
		brightness: 0.5,
		saveToFlash: false,
	},
});
```

Use `readConfiguration()` to read current LED state from the device:

```ts
const configuration = await device.readConfiguration();
const color = configuration.led?.color;
```

## LED Options

| Option | Description |
| --- | --- |
| `led.color` | Sets LED 0. `r`, `g`, and `b` must be integers from `0` to `255`. |
| `led.colors` | Sets indexed LEDs with `{ index, values }`, where `values` is an array of `{ r, g, b }`. |
| `led.brightness` | Sets brightness. Must be from `0` to `1`. |
| `led.saveToFlash` | Persists brightness when used with `led.brightness`. |

## Implementation Notes

`HasLed` contributes RGB command IDs under `CMD.RGB`. It expects the composed device class to provide `id`, `bus`, `configure()`, `readConfiguration()`, and the base command contract from `M5ChainDevice`.

The implementation validates LED indexes, LED counts, RGB channel values, brightness, and `saveToFlash` before sending commands to the bus.
