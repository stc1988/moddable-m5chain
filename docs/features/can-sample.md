# CanSample API

`CanSample` adds an `onSample` callback, a synchronous `sample()` accessor, and integration with the shared bus poll loop.

## TypeScript Exports

```ts
import type { SampleHandler } from "types";
```

| Export | Description |
| --- | --- |
| `SampleHandler<T>` | `((sample: T) => void \| Promise<void>) \| null`, exported from `types`. |

## Used By

- Encoder
- Angle
- JoyStick
- ToF
- PIR

## Methods

| Method | Description |
| --- | --- |
| `device.onSample = (sample) => {}` | Registers a callback that receives each newly acquired sample. Set to `null` to clear it. |
| `device.sample()` | Returns the latest sampled value, or `undefined` before the first sample. Object samples are returned as shallow copies. |

`onSample` handlers may be synchronous or asynchronous. A rejected asynchronous handler is reported through
`m5chain.onError` with `context.source === "sample"`.

## Sample Values

Angle, JoyStick, ToF, and PIR dispatch `onSample` with the latest sampled value on every poll. Encoder dispatches `onSample` only when the encoder value changes.

| Device | `onSample` argument and `sample()` value |
| --- | --- |
| Encoder | Delta from previous encoder value (`number`) |
| Angle | Normalized angle value (`0.00` to `1.00`) |
| JoyStick | `{ x, y }` (`-128` to `127`) |
| ToF | Measured distance in millimeters (`number`) |
| PIR | Presence status (`PIRStatus`) |

## Poll Loop Behavior

The bus poll loop starts when at least one connected device has `onSample` set. It stops when all sample handlers are `null`.

Only devices with their own `onSample` handler are polled. Calling `sample()` alone does not start polling
or issue a UART request. For a one-time read, use the device-specific method such as `getDistance()`.

See [sample implementation hooks](../development.md#sample-implementation-hooks) when writing a custom device.
