# CanPoll API

`CanPoll` adds an `onPoll` callback and integrates a device with the shared bus poll loop.

## TypeScript Exports

```ts
import CanPoll from "canPoll";
import type { PollHandler } from "types";
```

| Export | Description |
| --- | --- |
| `CanPoll` | Default generic mixin export. |
| `PollHandler<T>` | `((value: T) => void) \| null`, exported from `types`. |

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
	async polling(): Promise<number | undefined> {
		return await this.getAngle12Value();
	}
}
```

## Methods

| Method | Description |
| --- | --- |
| `device.onPoll = (value) => {}` | Registers a poll callback. Set to `null` to clear it. |
| `device.hasOnPoll()` | Returns whether a poll callback is registered. |
| `await device.polling()` | Device implementation hook. Returns a value to dispatch or `undefined` to skip dispatch. |
| `device.dispatchOnPoll(value)` | Calls the registered `onPoll` handler. |

## Poll Values

| Device | `onPoll` value |
| --- | --- |
| Encoder | Delta from previous encoder value (`number`) |
| Angle | Normalized angle value (`0.00` to `1.00`) |
| JoyStick | `{ x, y }` (`-128` to `127`) |
| ToF | Measured distance in millimeters (`number`) |

## Poll Loop Behavior

The bus poll loop starts when at least one connected device has `onPoll` set. It stops when all poll handlers are `null`.

`CanPoll` notifies the bus only when the active/inactive state changes, so replacing one non-null handler with another does not restart the loop.
