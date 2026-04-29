# HasLed API

`HasLed` adds RGB LED commands to a device class.

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

## Common Device Methods

`HasLed` exposes LED operation methods used by application code:

```ts
await device.setLedColor(255, 0, 0);
await device.setLedBrightness(0.5);
const color = await device.getLedColor();
```

LED color and brightness are output state, not device configuration. They are intentionally not accepted by `configure()`.

## Mixin Methods

| Method | Description |
| --- | --- |
| `await device.setLedColor(r, g, b)` | Sets LED 0. `r`, `g`, and `b` must be integers from `0` to `255`. |
| `await device.getLedColor()` | Reads LED 0. Returns `{ r, g, b }` with `0` to `255` values. |
| `await device.setLedColors(index, num, colors)` | Sets `num` LEDs starting at `index`. `colors` is an array of `{ r, g, b }`. |
| `await device.getLedColors(index, num)` | Reads `num` LED colors starting at `index`. Returns `LedColor[]`. |
| `await device.setLedBrightness(brightness, saveToFlash = false)` | Sets brightness. `brightness` must be from `0` to `1`; `saveToFlash` must be a boolean. |
| `await device.getLedBrightness()` | Reads brightness as a `0` to `1` number. |

## Implementation Notes

`HasLed` contributes RGB command IDs under `CMD.RGB`. It expects the composed device class to provide `id`, `bus`, and the base command contract from `M5ChainDevice`.

The implementation validates LED indexes, LED counts, RGB channel values, brightness, and `saveToFlash` before sending commands to the bus.
