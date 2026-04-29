# CanPoll API

`CanPoll` adds an `onSample` callback, a synchronous `sample()` accessor, and integration with the shared bus poll loop.

## TypeScript Exports

```ts
import CanPoll from "canPoll";
import type { SampleHandler } from "types";
```

| Export | Description |
| --- | --- |
| `CanPoll` | Default generic mixin export. |
| `SampleHandler<T>` | `((this: { sample(): T \| undefined }) => void) \| null`, exported from `types`. |

## Used By

- Encoder
- Angle
- JoyStick
- ToF

## Composition

Pass the poll value type when composing a device class.

```ts
import CanPoll from "canPoll";
import HasLed from "hasLed";
import { withDeviceFeatures } from "m5chainDevice";

class M5ChainAngle extends withDeviceFeatures(HasLed, CanPoll<number>) {
	async polling(): Promise<number> {
		return await this.getAngle12Value();
	}
}
```

## Methods

| Method | Description |
| --- | --- |
| `device.onSample = function () {}` | Registers a sample callback. Set to `null` to clear it. |
| `device.sample()` | Returns the latest sampled value, or `undefined` before the first sample. Object samples are returned as shallow copies. |
| `device.hasOnSample()` | Returns whether a sample callback is registered. |
| `await device.polling()` | Device implementation hook. Returns a value to store as the latest sample, or `undefined` to skip dispatch. |
| `device.dispatchOnSample(value)` | Stores `value` as the latest sample and calls the registered `onSample` handler with `this` bound to the device. |

## Sample Values

Angle, JoyStick, and ToF dispatch `onSample` with the latest sampled value on every poll. Encoder dispatches `onSample` only when the encoder value changes.

| Device | `sample()` value |
| --- | --- |
| Encoder | Delta from previous encoder value (`number`) |
| Angle | Normalized angle value (`0.00` to `1.00`) |
| JoyStick | `{ x, y }` (`-128` to `127`) |
| ToF | Measured distance in millimeters (`number`) |

## Poll Loop Behavior

The bus poll loop starts when at least one connected device has `onSample` set. It stops when all sample handlers are `null`.

`CanPoll` notifies the bus only when the active/inactive state changes, so replacing one non-null handler with another does not restart the loop.
